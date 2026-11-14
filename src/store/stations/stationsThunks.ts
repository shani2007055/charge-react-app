import { createAsyncThunk } from '@reduxjs/toolkit';
import type { Station } from './stationsState';

// כתובת השרת (אפשר בהמשך לחבר לכתובת של ה-.NET שלך)
const API_URL = 'https://jsonplaceholder.typicode.com/posts'; // כתובת דמה לבדיקה כרגע

export const fetchStations = createAsyncThunk(
  'stations/fetchStations',
  async () => {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to load stations');
    }
    return (await response.json()) as Station[];
  }
);