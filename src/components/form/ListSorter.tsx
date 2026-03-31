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
          className={`px-3 py-2 border bg-gray-100 rounded-md shadow-sm ${
            snapshot.isDragging ? "border-gray-600" : "border-gray-300"
          }`}
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
    <div className="flex border border-gray-300 rounded-md shadow-sm">
      <div className="grid p-2">
        {displayIndex.map((i) => (
          <p key={i}>{i}. </p>
        ))}
      </div>
      <Droppable droppableId="droppable">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="grid gap-2 p-2"
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
