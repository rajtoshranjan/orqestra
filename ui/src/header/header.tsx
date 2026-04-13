import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

import React from "react";

export const Header: React.FC = () => {
  return (
    <Menubar className="w-full h-12 fixed z-50 px-5 opacity-80 shadow-lg border-l-0 border-r-0 border-t-0 rounded-none border-border bg-background">
      <MenubarMenu>
        <MenubarTrigger className="text-primary text-lg font-bold">
          DrawOps
        </MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Home</MenubarItem>
          <MenubarItem>
            New Project <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Share</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Logout</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
