import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SupportChatHome from "./components/SupportChatWidget";
import AdminInbox from "./pages/AdminInbox";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SupportChatHome />} />
        <Route path="/adminBhaiCode4" element={<AdminInbox />} />
      </Routes>
    </BrowserRouter>
  );
}
