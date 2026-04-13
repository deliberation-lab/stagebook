/**
 * Test wrapper for ListSorter that tracks reordering state internally.
 */
import React, { useState } from "react";
import { ListSorter } from "../form/ListSorter.js";

export interface MockListSorterProps {
  items: string[];
}

export function MockListSorter({ items: initialItems }: MockListSorterProps) {
  const [items, setItems] = useState(initialItems);

  return (
    <div>
      <ListSorter items={items} onChange={setItems} />
      <div data-testid="current-order" style={{ display: "none" }}>
        {items.join("|")}
      </div>
    </div>
  );
}
