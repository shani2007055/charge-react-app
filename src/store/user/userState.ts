export interface UserState {
  name: string;
  carModel: string;
  communityPoints: number;
}

export const initialState: UserState = {
  name: 'ישראל ישראלי',
  carModel: 'Tesla Model 3 Long Range',
  communityPoints: 150,
};