import React from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

const reorder = (
  list: string[],
  startIndex: number,
  endIndex: number,
): string[] => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

function ListItem({
  id,
  index,
  text,
}: {
  id: string;
  index: number;
  text: string;
}) {
  return (
    <Draggable key={id} draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          data-testid={`draggable-${index}`}
          style={{
            ...provided.draggableProps.style,
            padding: "0.5rem 0.75rem",
            border: `1px solid ${snapshot.isDragging ? "var(--score-text-secondary, #374151)" : "var(--score-border, #d1d5db)"}`,
            backgroundColor: "var(--score-bg-muted, #f9fafb)",
            borderRadius: "0.375rem",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
            fontSize: "0.875rem",
            color: "var(--score-text, #1f2937)",
            cursor: "grab",
          }}
        >
          ⇅ {text}
        </div>
      )}
    </Draggable>
  );
}

function List({ items }: { items: string[] }) {
  const displayIndex = [...Array(items.length + 1).keys()].slice(1);
  return (
    <div
      style={{
        display: "flex",
        border: "1px solid var(--score-border, #d1d5db)",
        borderRadius: "0.375rem",
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      }}
    >
      <div
        style={{
          display: "grid",
          padding: "0.5rem",
          alignContent: "start",
          gap: "0.5rem",
          color: "var(--score-text-muted, #6b7280)",
          fontSize: "0.875rem",
        }}
      >
        {displayIndex.map((i) => (
          <p
            key={i}
            style={{
              margin: 0,
              padding: "0.5rem 0",
              lineHeight: "1.25rem",
            }}
          >
            {i}.{" "}
          </p>
        ))}
      </div>
      <Droppable droppableId="droppable">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            style={{
              display: "grid",
              gap: "0.5rem",
              padding: "0.5rem",
              flex: 1,
            }}
          >
            {items.map((item, index) => (
              <ListItem key={item} id={item} index={index} text={item} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export interface ListSorterProps {
  items: string[];
  onChange: (reordered: string[]) => void;
}

export function ListSorter({ items, onChange }: ListSorterProps) {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = reorder(
      items,
      result.source.index,
      result.destination.index,
    );
    onChange(reordered);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <List items={items} />
    </DragDropContext>
  );
}
