'use client';

import { useState, useRef } from "react";
import CommandMenu from "./CommandMenu";

const Editor = () => {
  const [text, setText] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Detect "/" and open menu
    if (newText[cursorPosition - 1] === "/") {
      setShowMenu(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    setCursorPosition(e.currentTarget.selectionStart);
  };

  const handleSelect = (block: string) => {
    // Replace the "/" with the selected block
    const beforeSlash = text.slice(0, cursorPosition - 1);
    const afterSlash = text.slice(cursorPosition);
    const updatedText = `${beforeSlash}${block}${afterSlash}`;
    
    setText(updatedText);
    setShowMenu(false);

    // Refocus the textarea
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto p-4 bg-white rounded shadow">
      <textarea
        ref={inputRef}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder="Type here... Use '/' to open block menu"
        className="w-full h-40 p-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500"
      />
      {showMenu && (
        <div className="absolute left-4 top-24">
          <CommandMenu onSelect={handleSelect} />
        </div>
      )}
    </div>
  );
};

export default Editor;

