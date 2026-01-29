import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import SecureChat from "./pages/SecureChat";

const queryClient = new QueryClient();

const App = () => {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(Toaster),
      React.createElement(Sonner),
      React.createElement(
        HashRouter,
        null,
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/", element: React.createElement(SecureChat) }),
          // Redirect old chat paths to root for compatibility
          React.createElement(Route, { path: "/chat", element: React.createElement(SecureChat) }),
          React.createElement(Route, { path: "*", element: React.createElement(SecureChat) })
        )
      )
    )
  );
};

export default App;
