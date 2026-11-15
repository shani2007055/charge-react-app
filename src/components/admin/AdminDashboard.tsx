import { ShieldCheck } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';

export default function AdminDashboard() {

  const name = useAppSelector(state => state.user.name);

  return (
    <section style={{
      background: '#0f172a',
      color: 'white',
      padding: '60px',
      borderRadius: '24px'
    }}>

      <ShieldCheck size={48} color="#fb923c" />

      <h1>מערכת ניהול Smart EV</h1>

      <h2>שלום, {name}</h2>

      <p>
        ברוכים הבאים למרכז הבקרה והניהול
        של מערכת הטעינה.
      </p>

    </section>
  );
}