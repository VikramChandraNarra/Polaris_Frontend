'use client';

import { useState } from "react";

const blockOptions = [
  { name: "Text", shortcut: "T" },
  { name: "Heading 1", shortcut: "#" },
  { name: "Heading 2", shortcut: "##" },
  { name: "Heading 3", shortcut: "###" },
  { name: "Bulleted List", shortcut: "-" },
  { name: "Numbered List", shortcut: "1." },
  { name: "To-do List", shortcut: "[ ]" },
  { name: "Table", shortcut: "▦" },
];

interface CommandMenuProps {
  onSelect: (block: string) => void;
}

const CommandMenu: React.FC<CommandMenuProps> = ({ onSelect }) => {
  const [query, setQuery] = useState("");

  const filteredOptions = blockOptions.filter((option) =>
    option.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="w-64 bg-white border border-gray-300 shadow-lg rounded-md p-2 z-50">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full p-2 border rounded mb-2 outline-none"
        placeholder="Type to filter..."
      />
      <ul>
        {filteredOptions.map((option) => (
          <li
            key={option.name}
            onClick={() => onSelect(option.name)}
            className="p-2 hover:bg-gray-100 cursor-pointer rounded"
          >
            {option.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CommandMenu;
