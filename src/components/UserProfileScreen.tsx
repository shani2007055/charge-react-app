import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/apiClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout, updateUserName } from '../store/user/userSlice';

interface UserClaim {
  type: string;
  value: string;
}

interface UserProfileDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  access: string;
  driverId: number | null;
  ownerId: number | null;
}

interface VehicleDto {
  id: number;
  driverId: number;
  model: string;
  batteryCapacityKwh: number;
  currentBattery: number;
  supportedChargerType: string;
}

type ChargerType = 'CCS' | 'Type2';

const ISRAELI_PHONE_REGEX = /^0\d{1,2}-?\d{7}$/;

export default function UserProfileScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { role } = useAppSelector((state) => state.user);

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // עריכת פרטי משתמש
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  // הוספת רכב חדש
  const [showAddVehicle, setShowAddVehicle] = useState<boolean>(false);
  const [newModel, setNewModel] = useState<string>('');
  const [newCapacityKwh, setNewCapacityKwh] = useState<string>('60');
  const [newCurrentBattery, setNewCurrentBattery] = useState<string>('50');
  const [newChargerType, setNewChargerType] = useState<ChargerType>('CCS');
  const [savingNewVehicle, setSavingNewVehicle] = useState<boolean>(false);

  // עריכת רכב קיים
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [editModel, setEditModel] = useState<string>('');
  const [editCapacityKwh, setEditCapacityKwh] = useState<string>('');
  const [editCurrentBattery, setEditCurrentBattery] = useState<string>('');
  const [editChargerType, setEditChargerType] = useState<ChargerType>('CCS');
  const [savingVehicleEdit, setSavingVehicleEdit] = useState<boolean>(false);

  // אישור מחיקת רכב בלי window.confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadProfileData = async () => {
    setLoading(true);
    setError(null);

    try {
      const claims = await apiFetch<UserClaim[]>('/users/me');
      const userIdClaim = claims.find(
        (c) => c.type === 'nameid' || c.type.endsWith('/nameidentifier')
      );

      if (!userIdClaim) {
        throw new Error('לא נמצא מזהה משתמש בטוקן. נסי להתחבר מחדש.');
      }

      const userId = Number(userIdClaim.value);
      const userProfile = await apiFetch<UserProfileDto>(`/users/${userId}`);

      setProfile(userProfile);
      setEditName(userProfile.name);
      setEditPhone(userProfile.phone);

      if (userProfile.driverId !== null) {
        const myVehicles = await apiFetch<VehicleDto[]>('/UsersVehicles/my');
        setVehicles(myVehicles);
      } else {
        setVehicles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת הפרופיל');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfileData();
  }, []);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const trimmedName = editName.trim();
    const trimmedPhone = editPhone.trim();

    if (trimmedName.length < 2 || trimmedName.length > 60) {
      setError('השם חייב להכיל בין 2 ל-60 תווים.');
      return;
    }

    if (!ISRAELI_PHONE_REGEX.test(trimmedPhone)) {
      setError('מספר טלפון חייב להיות בפורמט ישראלי תקין (למשל 050-1234567).');
      return;
    }

    setSavingProfile(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await apiFetch<UserProfileDto>(`/users/${profile.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
        }),
      });

      setProfile(updated);
      dispatch(updateUserName(updated.name));
      setIsEditingProfile(false);
      setSuccessMessage('הפרטים האישיים עודכנו בהצלחה!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הפרופיל');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddVehicle = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedModel = newModel.trim();
    const capacity = Number(newCapacityKwh);
    const battery = Number(newCurrentBattery);

    if (trimmedModel.length < 2) {
      setError('דגם הרכב חייב להכיל לפחות 2 תווים.');
      return;
    }
    if (Number.isNaN(capacity) || capacity < 1 || capacity > 300) {
      setError('קיבולת הסוללה חייבת להיות בין 1 ל-300 קוט"ש.');
      return;
    }
    if (Number.isNaN(battery) || battery < 0 || battery > 100) {
      setError('אחוז הסוללה חייב להיות בין 0 ל-100.');
      return;
    }

    setSavingNewVehicle(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const created = await apiFetch<VehicleDto>('/UsersVehicles', {
        method: 'POST',
        body: JSON.stringify({
          model: trimmedModel,
          batteryCapacityKwh: capacity,
          currentBattery: battery,
          supportedChargerType: newChargerType,
        }),
      });

      setVehicles((prev) => [...prev, created]);
      setNewModel('');
      setNewCapacityKwh('60');
      setNewCurrentBattery('50');
      setNewChargerType('CCS');
      setShowAddVehicle(false);
      setSuccessMessage(`הרכב "${created.model}" נוסף בהצלחה!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהוספת הרכב');
    } finally {
      setSavingNewVehicle(false);
    }
  };

  const startEditVehicle = (vehicle: VehicleDto) => {
    setEditingVehicleId(vehicle.id);
    setEditModel(vehicle.model);
    setEditCapacityKwh(String(vehicle.batteryCapacityKwh));
    setEditCurrentBattery(String(vehicle.currentBattery));
    setEditChargerType(vehicle.supportedChargerType === 'Type2' ? 'Type2' : 'CCS');
    setError(null);
    setSuccessMessage(null);
  };

  const handleSaveVehicleEdit = async (e: FormEvent, vehicleId: number) => {
    e.preventDefault();
    const trimmedModel = editModel.trim();
    const capacity = Number(editCapacityKwh);
    const battery = Number(editCurrentBattery);

    if (trimmedModel.length < 2) {
      setError('דגם הרכב חייב להכיל לפחות 2 תווים.');
      return;
    }
    if (Number.isNaN(capacity) || capacity < 1 || capacity > 300) {
      setError('קיבולת הסוללה חייבת להיות בין 1 ל-300 קוט"ש.');
      return;
    }
    if (Number.isNaN(battery) || battery < 0 || battery > 100) {
      setError('אחוז הסוללה חייב להיות בין 0 ל-100.');
      return;
    }

    setSavingVehicleEdit(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await apiFetch<VehicleDto>(`/UsersVehicles/${vehicleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          model: trimmedModel,
          batteryCapacityKwh: capacity,
          currentBattery: battery,
          supportedChargerType: editChargerType,
        }),
      });

      setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? updated : v)));
      setEditingVehicleId(null);
      setSuccessMessage('פרטי הרכב עודכנו בהצלחה!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הרכב');
    } finally {
      setSavingVehicleEdit(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: number) => {
    setDeletingId(vehicleId);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiFetch<string>(`/UsersVehicles/${vehicleId}`, {
        method: 'DELETE',
      });
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
      setConfirmDeleteId(null);
      setSuccessMessage('הרכב הוסר מהרשימה.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה במחיקת הרכב');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <div className="container" dir="rtl">
      <div className="screen-view">
        <div className="screen-header">
          <span>👤 פרופיל משתמש וניהול רכבים</span>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', color: 'white', padding: '24px' }}>
            טוען פרטי פרופיל...
          </div>
        )}

        {error && (
          <div
            style={{
              maxWidth: '650px',
              margin: '0 auto 16px auto',
              background: '#4a1818',
              color: '#ff9c9c',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #8a2b2b',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              maxWidth: '650px',
              margin: '0 auto 16px auto',
              background: '#133d24',
              color: '#7ef2a9',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #257a47',
            }}
          >
            ✅ {successMessage}
          </div>
        )}

        {!loading && profile && (
          <div style={{ maxWidth: '650px', margin: '0 auto', display: 'grid', gap: '20px' }}>
            {/* כרטיס פרטים אישיים */}
            <div
              style={{
                background: '#121212',
                padding: '20px',
                borderRadius: '10px',
                color: 'white',
                border: '1px solid #333',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px',
                  gap: '10px',
                }}
              >
                <h2 style={{ margin: 0, color: 'white' }}>שלום, {profile.name}</h2>
                {!isEditingProfile && (
                  <button
                    type="button"
                    className="btn"
                    style={{ width: 'auto', padding: '8px 14px' }}
                    onClick={() => {
                      setEditName(profile.name);
                      setEditPhone(profile.phone);
                      setIsEditingProfile(true);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                  >
                    ✏️ ערוך פרטים
                  </button>
                )}
              </div>

              {!isEditingProfile ? (
                <div style={{ display: 'grid', gap: '8px', fontSize: '0.98rem' }}>
                  <div>
                    📧 אימייל: <strong>{profile.email}</strong>
                  </div>
                  <div>
                    📱 טלפון: <strong>{profile.phone || 'לא הוזן'}</strong>
                  </div>
                  <div>
                    🎭 מצב פעיל: <strong>{role === 'Owner' ? 'בעל עמדה' : 'נהג'}</strong>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#bbb', marginTop: '4px' }}>
                    פרופילים משויכים:{' '}
                    {profile.driverId !== null ? '🚗 נהג ' : ''}
                    {profile.ownerId !== null ? '⚡ בעל עמדות' : ''}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                      שם מלא
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #444',
                        background: '#1e1e1e',
                        color: 'white',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>
                      טלפון (למשל 050-1234567)
                    </label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #444',
                        background: '#1e1e1e',
                        color: 'white',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" className="btn" disabled={savingProfile}>
                      {savingProfile ? 'שומר...' : '💾 שמור שינויים'}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: '#444' }}
                      onClick={() => setIsEditingProfile(false)}
                    >
                      ביטול
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* כרטיס ניהול רכבים (לנהגים) */}
            {profile.driverId !== null && (
              <div
                style={{
                  background: '#121212',
                  padding: '20px',
                  borderRadius: '10px',
                  color: 'white',
                  border: '1px solid #333',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px',
                  }}
                >
                  <h3 style={{ margin: 0, color: 'white' }}>🚗 הרכבים שלי</h3>
                  <button
                    type="button"
                    className="btn"
                    style={{ width: 'auto', padding: '8px 14px' }}
                    onClick={() => {
                      setShowAddVehicle((prev) => !prev);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                  >
                    {showAddVehicle ? 'סגור טופס' : '+ הוסף רכב'}
                  </button>
                </div>

                {showAddVehicle && (
                  <form
                    onSubmit={handleAddVehicle}
                    style={{
                      background: '#1b1b1b',
                      padding: '15px',
                      borderRadius: '8px',
                      border: '1px solid #333',
                      marginBottom: '16px',
                      display: 'grid',
                      gap: '10px',
                    }}
                  >
                    <input
                      type="text"
                      placeholder="דגם רכב (למשל Tesla Model 3 / BYD Atto 3)"
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      required
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #444',
                        background: '#121212',
                        color: 'white',
                      }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#bbb' }}>סוג שקע</label>
                        <select
                          value={newChargerType}
                          onChange={(e) => setNewChargerType(e.target.value as ChargerType)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #444',
                            background: '#121212',
                            color: 'white',
                          }}
                        >
                          <option value="CCS">CCS (מהיר)</option>
                          <option value="Type2">Type2 (רגיל)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#bbb' }}>קיבולת (kWh)</label>
                        <input
                          type="number"
                          min={1}
                          max={300}
                          value={newCapacityKwh}
                          onChange={(e) => setNewCapacityKwh(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #444',
                            background: '#121212',
                            color: 'white',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#bbb' }}>סוללה כעת (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={newCurrentBattery}
                          onChange={(e) => setNewCurrentBattery(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #444',
                            background: '#121212',
                            color: 'white',
                          }}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn" disabled={savingNewVehicle}>
                      {savingNewVehicle ? 'מוסיף...' : '✅ שמור רכב חדש'}
                    </button>
                  </form>
                )}

                {vehicles.length === 0 ? (
                  <p style={{ color: '#aaa', margin: 0 }}>
                    עדיין לא הוגדר רכב. אפשר להוסיף כאן או שהמערכת תיצור רכב ברירת מחדל בשריון הראשון.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        style={{
                          background: '#1a1a1a',
                          padding: '14px',
                          borderRadius: '8px',
                          border: '1px solid #2e2e2e',
                        }}
                      >
                        {editingVehicleId === vehicle.id ? (
                          <form
                            onSubmit={(e) => void handleSaveVehicleEdit(e, vehicle.id)}
                            style={{ display: 'grid', gap: '10px' }}
                          >
                            <input
                              type="text"
                              value={editModel}
                              onChange={(e) => setEditModel(e.target.value)}
                              required
                              style={{
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #444',
                                background: '#121212',
                                color: 'white',
                              }}
                            />
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr',
                                gap: '8px',
                              }}
                            >
                              <select
                                value={editChargerType}
                                onChange={(e) =>
                                  setEditChargerType(e.target.value as ChargerType)
                                }
                                style={{
                                  padding: '8px',
                                  borderRadius: '6px',
                                  border: '1px solid #444',
                                  background: '#121212',
                                  color: 'white',
                                }}
                              >
                                <option value="CCS">CCS</option>
                                <option value="Type2">Type2</option>
                              </select>
                              <input
                                type="number"
                                min={1}
                                max={300}
                                value={editCapacityKwh}
                                onChange={(e) => setEditCapacityKwh(e.target.value)}
                                title="קיבולת בקוט״ש"
                                required
                                style={{
                                  padding: '8px',
                                  borderRadius: '6px',
                                  border: '1px solid #444',
                                  background: '#121212',
                                  color: 'white',
                                }}
                              />
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={editCurrentBattery}
                                onChange={(e) => setEditCurrentBattery(e.target.value)}
                                title="סוללה נוכחית (%)"
                                required
                                style={{
                                  padding: '8px',
                                  borderRadius: '6px',
                                  border: '1px solid #444',
                                  background: '#121212',
                                  color: 'white',
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="submit"
                                className="btn"
                                disabled={savingVehicleEdit}
                              >
                                {savingVehicleEdit ? 'שומר...' : '💾 שמור'}
                              </button>
                              <button
                                type="button"
                                className="btn"
                                style={{ background: '#444' }}
                                onClick={() => setEditingVehicleId(null)}
                              >
                                ביטול
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                                {vehicle.model}
                              </div>
                              <div style={{ fontSize: '0.9rem', color: '#ccc', marginTop: '4px' }}>
                                שקע: <strong>{vehicle.supportedChargerType}</strong> | קיבולת:{' '}
                                <strong>{vehicle.batteryCapacityKwh} kWh</strong> | סוללה נוכחית:{' '}
                                <strong>{vehicle.currentBattery}%</strong>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className="btn"
                                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
                                onClick={() => startEditVehicle(vehicle)}
                              >
                                ✏️ ערוך
                              </button>

                              {confirmDeleteId === vehicle.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn"
                                    style={{
                                      width: 'auto',
                                      padding: '6px 12px',
                                      fontSize: '0.85rem',
                                      background: '#b91c1c',
                                    }}
                                    disabled={deletingId === vehicle.id}
                                    onClick={() => void handleDeleteVehicle(vehicle.id)}
                                  >
                                    {deletingId === vehicle.id ? 'מוחק...' : 'אשר מחיקה'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn"
                                    style={{
                                      width: 'auto',
                                      padding: '6px 12px',
                                      fontSize: '0.85rem',
                                      background: '#444',
                                    }}
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    בטל
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="btn"
                                  style={{
                                    width: 'auto',
                                    padding: '6px 12px',
                                    fontSize: '0.85rem',
                                    background: '#7f1d1d',
                                  }}
                                  onClick={() => setConfirmDeleteId(vehicle.id)}
                                >
                                  🗑️ מחק
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* התנתקות */}
            <button
              type="button"
              className="btn"
              style={{ background: '#7f1d1d' }}
              onClick={handleLogout}
            >
              🚪 התנתק מהמערכת
            </button>
          </div>
        )}
      </div>
    </div>
  );
}