import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../api/apiClient';
import { isAdminToken, type UserRole } from './userState';

interface AuthResponse {
  token: string;
  requestedRole: UserRole;
  hasRequestedProfile: boolean;
}

interface LoginPayload {
  email: string;
  password: string;
  role: UserRole;
}

interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}

interface UserClaim {
  type: string;
  value: string;
}

export interface AuthSuccessResult {
  id: number | null;
  name: string;
  email: string;
  role: UserRole;
  token: string;
}

async function readUser(
  token: string,
  role: UserRole
): Promise<AuthSuccessResult> {

  const claims = await apiFetch<UserClaim[]>('/users/me');

  const id = claims.find(
    c => c.type.endsWith('/nameidentifier')
  )?.value;

  const name = claims.find(
    c => c.type.endsWith('/name')
  )?.value;

  const email = claims.find(
    c => c.type.endsWith('/emailaddress')
  )?.value;

  return {
    id: id ? Number(id) : null,
    name: name || email || 'משתמש',
    email: email || '',
    role,
    token
  };
}

export const loginUser = createAsyncThunk<
  AuthSuccessResult,
  LoginPayload
>(
  'user/loginUser',

  async ({ email, password, role }) => {

    let authData = await apiFetch<AuthResponse>(
      '/users/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, role })
      }
    );

    localStorage.setItem('token', authData.token);

    try {

      if (
        !isAdminToken(authData.token) &&
        !authData.hasRequestedProfile &&
        role === 'Driver'
      ) {

        authData = await apiFetch<AuthResponse>(
          '/users/become-driver',
          { method: 'POST' }
        );

        localStorage.setItem('token', authData.token);
      }

      return await readUser(authData.token, role);

    } catch (error) {
      localStorage.removeItem('token');
      throw error;
    }
  }
);

export const registerUser = createAsyncThunk<
  AuthSuccessResult,
  RegisterPayload
>(
  'user/registerUser',

  async (payload, { dispatch }) => {

    await apiFetch('/users/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return await dispatch(
      loginUser({
        email: payload.email,
        password: payload.password,
        role: payload.role
      })
    ).unwrap();
  }
);

export const switchUserRole = createAsyncThunk<
  AuthSuccessResult,
  UserRole
>(
  'user/switchUserRole',

  async (role) => {

    const previousToken = localStorage.getItem('token');

    const endpoint =
      role === 'Owner'
        ? '/users/become-owner'
        : '/users/become-driver';

    const authData = await apiFetch<AuthResponse>(
      endpoint,
      { method: 'POST' }
    );

    localStorage.setItem('token', authData.token);

    try {
      return await readUser(authData.token, role);
    } catch (error) {
      if (previousToken) {
        localStorage.setItem('token', previousToken);
      } else {
        localStorage.removeItem('token');
      }
      throw error;
    }
  }
);