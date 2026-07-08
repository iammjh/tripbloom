import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const id = localStorage.getItem('userId');
      const name = localStorage.getItem('userName');
      const role = localStorage.getItem('userRole');
      if (id) return { id, name, role };
      return null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    // keep localStorage in sync when user changes
    if (user) {
      localStorage.setItem('userId', user.id || '');
      if (user.name) localStorage.setItem('userName', user.name);
      if (user.role) localStorage.setItem('userRole', user.role);
    } else {
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      localStorage.removeItem('token');
    }
  }, [user]);

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
