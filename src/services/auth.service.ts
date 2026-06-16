import { MOCK_USERS } from '@/lib/constants/mock-users';
import type { AuthUser } from '@/store/useAuthStore';

interface LoginResult {
  user: AuthUser;
  token: string;
}

// Simulated credential store — password matches company convention
const CREDENTIALS: Record<string, string> = {
  'julian.lozano@spybee.io': 'spybee123',
  'julian.rico@spybee.io': 'spybee123',
  'ana.gomez@spybee.io': 'spybee123',
  'mateo.soto@constructora.com': 'constructora123',
  'felipe.herrera@constructora.com': 'constructora123',
  'sebastian.castro@constructora.com': 'constructora123',
  'nicolas.fernandez@constructora.com': 'constructora123',
  'valentina.ramirez@constructora.com': 'constructora123',
  'carlos.lopez@pruebaempresa.com': 'prueba123',
  'maria.torres@pruebaempresa.com': 'prueba123',
};

export async function login(email: string, password: string): Promise<LoginResult> {
  await new Promise((r) => setTimeout(r, 450));

  const expected = CREDENTIALS[email.toLowerCase().trim()];
  if (!expected || expected !== password) {
    throw new Error('Credenciales inválidas. Verifica tu email y contraseña.');
  }

  const found = MOCK_USERS.find((u) => u.email === email.toLowerCase().trim());
  if (!found) throw new Error('Usuario no encontrado.');

  const user: AuthUser = {
    id: found.id,
    name: found.name,
    email: found.email,
    avatarUrl: found.avatarUrl,
    role: found.role ?? 'Usuario',
    company: found.company,
  };

  return { user, token: crypto.randomUUID() };
}

export async function logout(): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
}
