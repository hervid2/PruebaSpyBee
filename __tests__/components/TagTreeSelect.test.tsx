/**
 * Component tests for TagTreeSelect: rendering tags, select/deselect via node
 * and chip, search filtering with an empty state, multi-select accumulation,
 * and checkbox state for the controlled selection.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TagTreeSelect from '@/components/modals/create-issue/TagTreeSelect';
import type { Tag } from '@/domain/models';

const TAGS: Tag[] = [
  { id: 'tag-1', name: 'Urgente', color: '#F59E0B' },
  { id: 'tag-2', name: 'Calidad', color: '#8B5CF6' },
  { id: 'tag-3', name: 'Seguridad', color: '#10B981' },
];

describe('TagTreeSelect', () => {
  it('renderiza las etiquetas disponibles', () => {
    render(<TagTreeSelect tags={TAGS} selectedIds={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByText('Calidad')).toBeInTheDocument();
    expect(screen.getByText('Seguridad')).toBeInTheDocument();
  });

  it('llama a onChange al seleccionar una etiqueta', () => {
    const onChange = vi.fn();
    render(<TagTreeSelect tags={TAGS} selectedIds={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Urgente'));
    expect(onChange).toHaveBeenCalledWith(['tag-1']);
  });

  it('llama a onChange al deseleccionar una etiqueta ya seleccionada', () => {
    const onChange = vi.fn();
    render(<TagTreeSelect tags={TAGS} selectedIds={['tag-1']} onChange={onChange} />);
    // deselect via chip remove button
    fireEvent.click(screen.getByLabelText('Quitar etiqueta Urgente'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('muestra chip removible para cada etiqueta seleccionada', () => {
    render(<TagTreeSelect tags={TAGS} selectedIds={['tag-1', 'tag-2']} onChange={vi.fn()} />);
    // Chips appear in the chips list (role="list") and also in the tree, so we check by aria-label
    expect(screen.getByLabelText('Quitar etiqueta Urgente')).toBeInTheDocument();
    expect(screen.getByLabelText('Quitar etiqueta Calidad')).toBeInTheDocument();
    // Both names appear at least once (chip + tree node)
    expect(screen.getAllByText('Urgente').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Calidad').length).toBeGreaterThanOrEqual(1);
  });

  it('filtra etiquetas al escribir en el buscador', () => {
    render(<TagTreeSelect tags={TAGS} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar etiqueta...'), {
      target: { value: 'urg' },
    });
    // "Urgente" should appear in the tree (at least the node label)
    const labels = screen.getAllByText('Urgente');
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.queryByText('Calidad')).not.toBeInTheDocument();
  });

  it('muestra "Sin resultados" cuando el filtro no coincide con ninguna etiqueta', () => {
    render(<TagTreeSelect tags={TAGS} selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar etiqueta...'), {
      target: { value: 'zzznomatch' },
    });
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('selecciona múltiples etiquetas acumulando los IDs', () => {
    const onChange = vi.fn();
    const { rerender } = render(<TagTreeSelect tags={TAGS} selectedIds={[]} onChange={onChange} />);

    fireEvent.click(screen.getByText('Urgente'));
    expect(onChange).toHaveBeenLastCalledWith(['tag-1']);

    rerender(<TagTreeSelect tags={TAGS} selectedIds={['tag-1']} onChange={onChange} />);
    fireEvent.click(screen.getByText('Calidad'));
    expect(onChange).toHaveBeenLastCalledWith(['tag-1', 'tag-2']);
  });

  it('renderiza checkbox con estado "checked" para etiquetas seleccionadas', () => {
    render(<TagTreeSelect tags={TAGS} selectedIds={['tag-2']} onChange={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    const calidad = checkboxes.find((cb) =>
      cb.closest('[role="treeitem"]')?.textContent?.includes('Calidad'),
    );
    expect(calidad?.checked).toBe(true);
  });
});
