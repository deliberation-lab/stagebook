/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */

import { templateContextSchema } from "../schemas/treatment.js";

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function substituteFields({
  templateContent,
  fields,
}: {
  templateContent: any;
  fields: Record<string, any>;
}): any {
  let expandedTemplate = JSON.parse(JSON.stringify(templateContent));

  for (const [key, value] of Object.entries(fields)) {
    let stringifiedTemplate = JSON.stringify(expandedTemplate);
    const stringifiedValue = JSON.stringify(value);

    // replace all instances of `"${key}"` with serialized value
    // this handles objects and arrays, etc.
    const escapedKey = escapeRegExp(key);
    const objectReplacementRegex = new RegExp(`"\\$\\{${escapedKey}\\}"`, "g");
    stringifiedTemplate = stringifiedTemplate.replace(
      objectReplacementRegex,
      stringifiedValue,
    );

    // if the value is just a string or number, we can also replace instances of ${key} within other strings
    if (typeof value === "string") {
      const stringReplacementRegex = new RegExp(`\\$\\{${escapedKey}\\}`, "g");
      stringifiedTemplate = stringifiedTemplate.replace(
        stringReplacementRegex,
        value,
      );
    }

    expandedTemplate = JSON.parse(stringifiedTemplate);
  }
  return expandedTemplate;
}

export function expandTemplate({
  templates,
  context,
}: {
  templates: any[];
  context: any;
}): any {
  // Step 1: Fill in any templates within the context itself
  const newContext = JSON.parse(JSON.stringify(context));
  if (newContext.fields) {
    newContext.fields = recursivelyFillTemplates({
      obj: newContext.fields,
      templates,
    });
  }
  if (newContext.broadcast) {
    newContext.broadcast = recursivelyFillTemplates({
      obj: newContext.broadcast,
      templates,
    });
  }

  // Find the matching template
  const template = templates.find(
    (t: any) => t.templateName === newContext.template,
  );
  if (!template) {
    throw new Error(`Template "${newContext.template}" not found`);
  }

  let expandedTemplate = JSON.parse(JSON.stringify(template.templateContent));

  // Step 3: Apply given fields if any
  if (newContext.fields) {
    expandedTemplate = substituteFields({
      templateContent: expandedTemplate,
      fields: newContext.fields,
    });
  }

  // Step 4: Handle broadcast fields if any
  function flattenBroadcast(
    dimensions: Record<string, any[]>,
  ): Record<string, any>[] {
    const dimensionIndices = Object.keys(dimensions);
    const dimensionNumbers = dimensionIndices.map((i) => parseInt(i.slice(1)));
    const lowestDimension = Math.min(...dimensionNumbers);

    const currentDimension = dimensions[`d${lowestDimension}`];
    const remainingDimensions = JSON.parse(JSON.stringify(dimensions));
    delete remainingDimensions[`d${lowestDimension}`];

    let partialFields: Record<string, any>[] = [{}];
    if (Object.keys(remainingDimensions).length > 0) {
      partialFields = flattenBroadcast(remainingDimensions);
    }

    const flatFields: Record<string, any>[] = [];
    for (const [index, entry] of currentDimension.entries()) {
      for (const partialField of partialFields) {
        const newField = { ...entry, ...partialField };
        newField[`d${lowestDimension}`] = `${index}`;
        flatFields.push(newField);
      }
    }
    return flatFields;
  }

  if (newContext.broadcast) {
    const broadcastFieldsArray = flattenBroadcast(newContext.broadcast);
    const returnObjects: any[] = [];
    for (const broadcastFields of broadcastFieldsArray) {
      const newObj = substituteFields({
        templateContent: expandedTemplate,
        fields: broadcastFields,
      });
      if (Array.isArray(newObj)) {
        returnObjects.push(...newObj);
      } else if (typeof newObj === "object") {
        returnObjects.push(newObj);
      } else {
        throw new Error("Unexpected type in broadcast fields");
      }
    }
    return returnObjects;
  }

  return expandedTemplate;
}

const MAX_TEMPLATE_DEPTH = 100;

export function recursivelyFillTemplates({
  obj,
  templates,
  depth = 0,
  templateChain = [],
}: {
  obj: any;
  templates: any[];
  depth?: number;
  templateChain?: string[];
}): any {
  if (depth > MAX_TEMPLATE_DEPTH) {
    const chain =
      templateChain.length > 0
        ? ` Template chain: ${templateChain.slice(-10).join(" → ")}`
        : "";
    throw new Error(
      `Maximum template nesting depth (${MAX_TEMPLATE_DEPTH}) exceeded.${chain} Check for circular template references in your treatment file.`,
    );
  }
  let newObj: any;
  try {
    newObj = JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.log("Error parsing", obj);
    throw e;
  }

  if (!Array.isArray(newObj) && typeof newObj === "object") {
    if (newObj && newObj.template) {
      const templateName = newObj.template as string;
      const context = templateContextSchema.parse(newObj);
      newObj = expandTemplate({ templates, context });
      newObj = recursivelyFillTemplates({
        obj: newObj,
        templates,
        depth: depth + 1,
        templateChain: [...templateChain, templateName],
      });
    } else {
      for (const key in newObj) {
        if (newObj[key] == null) {
          console.log(`key ${key} is undefined in`, newObj);
        }
        newObj[key] = recursivelyFillTemplates({
          obj: newObj[key],
          templates,
          depth: depth + 1,
          templateChain,
        });
      }
    }
  } else if (Array.isArray(newObj)) {
    for (const [index, item] of newObj.entries()) {
      if (item.template) {
        const context = templateContextSchema.parse(item);
        const expandedItem = expandTemplate({ templates, context });
        if (Array.isArray(expandedItem)) {
          newObj.splice(index, 1, ...expandedItem);
        } else if (typeof expandedItem === "object") {
          newObj[index] = expandedItem;
        } else {
          throw new Error("Unexpected type in expanded item");
        }
      } else {
        newObj[index] = recursivelyFillTemplates({
          obj: item,
          templates,
          depth: depth + 1,
          templateChain,
        });
      }
    }
  }

  return newObj;
}

export function fillTemplates({
  obj,
  templates,
}: {
  obj: any;
  templates: any[];
}): any {
  let newObj = recursivelyFillTemplates({ obj, templates });

  // Check that there are no remaining templates
  const templatesRemainingRegex = /"template":/g;
  let templatesRemaining = JSON.stringify(newObj).match(
    templatesRemainingRegex,
  );
  while (templatesRemaining) {
    newObj = recursivelyFillTemplates({ obj: newObj, templates });
    templatesRemaining = JSON.stringify(newObj).match(templatesRemainingRegex);
  }

  // Check that all fields are filled
  const doubleCheckRegex = /\$\{[a-zA-Z0-9_]+\}/g;
  const missingFields = JSON.stringify(newObj).match(doubleCheckRegex);
  if (missingFields) {
    throw new Error(`Missing fields: ${missingFields.join(", ")}`);
  }

  return newObj;
}
