import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="w-full h-12 border-b border-gray-200 bg-black opacity-85 fixed z-50 flex items-center px-5 shadow-lg">
      <h3 className="text-white text-lg font-bold">DrawOps</h3>
    </header>
  );
};
