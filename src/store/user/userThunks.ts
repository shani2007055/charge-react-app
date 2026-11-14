import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../../api/apiClient';
import type { UserRole } from './userState';

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

export const loginUser = createAsyncThunk<AuthSuccessResult, LoginPayload>(
  'user/loginUser',
  async ({ email, password, role }) => {
    let authData = await apiFetch<AuthResponse>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });

    localStorage.setItem('token', authData.token);

    if (!authData.hasRequestedProfile) {
      const endpoint = role === 'Owner' ? '/users/become-owner' : '/users/become-driver';
      authData = await apiFetch<AuthResponse>(endpoint, { method: 'POST' });
      localStorage.setItem('token', authData.token);
    }

    const claims = await apiFetch<UserClaim[]>('/users/me');
    const idValue = claims.find((c) => c.type.endsWith('/nameidentifier'))?.value;
    const nameValue = claims.find((c) => c.type.endsWith('/name'))?.value;
    const emailValue = claims.find((c) => c.type.endsWith('/emailaddress'))?.value;

    return {
      id: idValue ? Number(idValue) : null,
      name: nameValue || email,
      email: emailValue || email,
      role,
      token: authData.token,
    };
  }
);

export const registerUser = createAsyncThunk<AuthSuccessResult, RegisterPayload>(
  'user/registerUser',
  async (payload, { dispatch }) => {
    await apiFetch('/users/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return await dispatch(
      loginUser({
        email: payload.email,
        password: payload.password,
        role: payload.role,
      })
    ).unwrap();
  }
);