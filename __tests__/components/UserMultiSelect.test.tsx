import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UserMultiSelect from '@/components/modals/create-issue/UserMultiSelect';
import type { MockUserWithCompany } from '@/lib/constants/mock-users';

const USERS: MockUserWithCompany[] = [
  { id: 'u1', name: 'Ana Gómez', email: 'ana@spybee.io', company: 'SPYBEE', role: 'QA' },
  {
    id: 'u2',
    name: 'Carlos López',
    email: 'carlos@empresa.com',
    company: 'CONSTRUCTORA',
    role: 'Inspector',
  },
  {
    id: 'u3',
    name: 'María Torres',
    email: 'maria@empresa.com',
    company: 'CONSTRUCTORA',
    role: 'Directora',
  },
];

describe('UserMultiSelect', () => {
  it('renderiza los usuarios agrupados por compañía', () => {
    render(<UserMultiSelect users={USERS} selectedIds={[]} onChange={vi.fn()} />);
    expect(screen.getByText('SPYBEE')).toBeInTheDocument();
    expect(screen.getByText('CONSTRUCTORA')).toBeInTheDocument();
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
    expect(screen.getByText('Carlos López')).toBeInTheDocument();
  });

  it('llama a onChange al seleccionar un usuario', () => {
    const onChange = vi.fn();
    render(<UserMultiSelect users={USERS} selectedIds={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Ana Gómez'));
    expect(onChange).toHaveBeenCalledWith(['u1']);
  });

  it('llama a onChange al deseleccionar un usuario ya seleccionado', () => {
    const onChange = vi.fn();
    render(<UserMultiSelect users={USERS} selectedIds={['u1']} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Quitar Ana Gómez'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('muestra chip para cada usuario seleccionado', () => {
    render(<UserMultiSelect users={USERS} selectedIds={['u1', 'u2']} onChange={vi.fn()} />);
    // Names appear in both chip and list option, so use getAllByText
    expect(screen.getAllByText('Ana Gómez').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Carlos López').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Quitar Ana Gómez')).toBeInTheDocument();
  });

  it('filtra usuarios por nombre al escribir en el buscador', () => {
    render(<UserMultiSelect users={USERS} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar usuario...'), {
      target: { value: 'ana' },
    });
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
    expect(screen.queryByText('Carlos López')).not.toBeInTheDocument();
  });

  it('filtra usuarios por compañía', () => {
    render(<UserMultiSelect users={USERS} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar usuario...'), {
      target: { value: 'SPYBEE' },
    });
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
    expect(screen.queryByText('Carlos López')).not.toBeInTheDocument();
  });

  it('muestra "Sin resultados" cuando no hay coincidencias', () => {
    render(<UserMultiSelect users={USERS} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar usuario...'), {
      target: { value: 'zzznomatch' },
    });
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('marca como aria-selected=true el usuario seleccionado', () => {
    render(<UserMultiSelect users={USERS} selectedIds={['u2']} onChange={vi.fn()} />);
    const option = screen
      .getAllByRole('option')
      .find((el) => el.textContent?.includes('Carlos López'));
    expect(option).toHaveAttribute('aria-selected', 'true');
  });

  it('acepta placeholder personalizado', () => {
    render(
      <UserMultiSelect
        users={USERS}
        selectedIds={[]}
        onChange={vi.fn()}
        placeholder="Buscar asignado..."
      />,
    );
    expect(screen.getByPlaceholderText('Buscar asignado...')).toBeInTheDocument();
  });
});
