import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useQuery } from 'react-query';
import { checkAuthStatus } from '../services/auth';

const AuthContext = createContext();

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  isAuthenticated: false,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check authentication status on mount
  const { data: authData, isLoading: authLoading } = useQuery(
    ['auth', state.token],
    () => checkAuthStatus(),
    {
      enabled: !!state.token,
      retry: false,
      onSuccess: (data) => {
        if (data.success) {
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user: data.data.user, token: state.token },
          });
        } else {
          dispatch({ type: 'LOGIN_FAILURE' });
        }
      },
      onError: () => {
        dispatch({ type: 'LOGIN_FAILURE' });
      },
    }
  );

  useEffect(() => {
    if (!state.token) {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.token]);

  useEffect(() => {
    if (!authLoading && state.token) {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [authLoading, state.token]);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    dispatch({
      type: 'LOGIN_SUCCESS',
      payload: { user: userData, token },
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData });
  };

  const value = {
    user: state.user,
    token: state.token,
    isLoading: state.isLoading || authLoading,
    isAuthenticated: state.isAuthenticated,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 