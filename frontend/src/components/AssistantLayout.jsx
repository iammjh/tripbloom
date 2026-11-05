import React from 'react';
import { Outlet } from 'react-router-dom';
import AssistantChat from './AssistantChat.jsx';

// Pathless layout for the public routes: renders the page and mounts the assistant once, so its conversation survives in-app navigation.
export default function AssistantLayout() {
  return (
    <>
      <Outlet />
      <AssistantChat />
    </>
  );
}
