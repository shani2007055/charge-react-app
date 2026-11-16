import { useEffect, useRef, useState } from 'react';
import { CarFront, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/apiClient';
import type { Vehicle } from '../../types/Vehicle';
import './VehicleSelector.css';

interface VehicleSelectorProps {
  selectedId: number | null;
  onSelect: (vehicle: Vehicle | null) => void;
  onVehiclesLoaded?: (vehicles: Vehicle[]) => void;
  disabled?: boolean;
}

export default function VehicleSelector({
  selectedId,
  onSelect,
  onVehiclesLoaded,
  disabled = false,
}: VehicleSelectorProps) {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const onVehiclesLoadedRef = useRef(onVehiclesLoaded);
  useEffect(() => {
    onVehiclesLoadedRef.current = onVehiclesLoaded;
  }, [onVehiclesLoaded]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadVehicles() {
      try {
        setLoading(true);
        setError('');
        const result = await apiFetch<Vehicle[]>('/UsersVehicles/my', {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setVehicles(result);
          onVehiclesLoadedRef.current?.(result);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : 'שגיאה בטעינת הרכבים'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadVehicles();
    return () => controller.abort();
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === selectedId);

  return (
    <section className="vehicle-selector">
      <div className="vehicle-selector-top">
        <label htmlFor="search-vehicle" className="vehicle-selector-title">
          <CarFront size={18} />
          <span>הרכב שלי</span>
        </label>

        <button
          type="button"
          className="vehicle-manage-btn"
          disabled={disabled}
          onClick={() => navigate('/profile')}
        >
          <PlusCircle size={15} />
          הוספה וניהול רכבים
        </button>
      </div>

      {loading ? (
        <p className="vehicle-status" role="status">
          טוען את הרכבים שלך...
        </p>
      ) : error ? (
        <div className="ev-alert-error">{error}</div>
      ) : vehicles.length === 0 ? (
        <div className="vehicle-empty">
          טרם הוספת רכב למערכת. יש להוסיף רכב לפני ביצוע שריון.
        </div>
      ) : (
        <>
          <select
            id="search-vehicle"
            className="form-control"
            value={selectedVehicle?.id ?? ''}
            disabled={disabled}
            onChange={(event) => {
              const vehicle = vehicles.find(
                (v) => v.id === Number(event.target.value)
              );
              onSelect(vehicle ?? null);
            }}
          >
            <option value="">יש לבחור רכב</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.model} · {vehicle.batteryCapacityKwh} kWh · {vehicle.supportedChargerType}
              </option>
            ))}
          </select>

          {selectedVehicle && (
            <div className="vehicle-selected-meta">
              <span>קיבולת: {selectedVehicle.batteryCapacityKwh} kWh</span>
              <span aria-hidden="true">·</span>
              <span>מחבר: {selectedVehicle.supportedChargerType}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}