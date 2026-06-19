/**
 * Unit tests for the create-incident Zod schema. Covers the happy path plus
 * each validation rule (required fields, length caps, past-date rejection,
 * enum and coordinate bounds) to lock the form's contract.
 */
import { describe, it, expect } from 'vitest';
import { issueFormSchema } from '@/lib/validators/issue-form.schema';

// Date helpers relative to "now" so the past/future due-date rules stay valid over time.
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const validBase = {
  title: 'Fisura en muro',
  description: 'Se detectó una fisura horizontal en el muro del piso 3',
  dueDate: tomorrow(),
  typeId: 'e05995817a9a9bf5c0298f7d',
  priority: 'high' as const,
};

describe('issueFormSchema', () => {
  describe('casos válidos', () => {
    it('acepta un formulario completo y mínimo válido', () => {
      const result = issueFormSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('acepta sin tagIds, assigneeIds y observerIds (campos opcionales)', () => {
      const result = issueFormSchema.safeParse(validBase);
      if (!result.success) throw result.error;
      // Fields are optional — undefined when not provided
      expect(result.data.tagIds).toBeUndefined();
      expect(result.data.assigneeIds).toBeUndefined();
      expect(result.data.observerIds).toBeUndefined();
    });

    it('acepta prioridad "medium" y "low"', () => {
      expect(issueFormSchema.safeParse({ ...validBase, priority: 'medium' }).success).toBe(true);
      expect(issueFormSchema.safeParse({ ...validBase, priority: 'low' }).success).toBe(true);
    });

    it('acepta coordenadas válidas', () => {
      const result = issueFormSchema.safeParse({
        ...validBase,
        coordinates: { lat: 4.71, lng: -74.07 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('título', () => {
    it('rechaza título vacío', () => {
      const result = issueFormSchema.safeParse({ ...validBase, title: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('title'))).toBe(true);
      }
    });

    it('rechaza título de más de 120 caracteres', () => {
      const result = issueFormSchema.safeParse({ ...validBase, title: 'A'.repeat(121) });
      expect(result.success).toBe(false);
    });

    it('acepta título en el límite exacto de 120 caracteres', () => {
      const result = issueFormSchema.safeParse({ ...validBase, title: 'A'.repeat(120) });
      expect(result.success).toBe(true);
    });
  });

  describe('descripción', () => {
    it('rechaza descripción vacía', () => {
      const result = issueFormSchema.safeParse({ ...validBase, description: '' });
      expect(result.success).toBe(false);
    });

    it('rechaza descripción de más de 1000 caracteres', () => {
      const result = issueFormSchema.safeParse({ ...validBase, description: 'B'.repeat(1001) });
      expect(result.success).toBe(false);
    });
  });

  describe('fecha de vencimiento', () => {
    it('rechaza fecha vacía', () => {
      const result = issueFormSchema.safeParse({ ...validBase, dueDate: '' });
      expect(result.success).toBe(false);
    });

    it('rechaza fecha pasada', () => {
      const result = issueFormSchema.safeParse({ ...validBase, dueDate: yesterday() });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('dueDate'))).toBe(true);
      }
    });

    it('rechaza cadena que no es fecha', () => {
      const result = issueFormSchema.safeParse({ ...validBase, dueDate: 'no-es-fecha' });
      expect(result.success).toBe(false);
    });
  });

  describe('categoría', () => {
    it('rechaza typeId vacío', () => {
      const result = issueFormSchema.safeParse({ ...validBase, typeId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('prioridad', () => {
    it('rechaza prioridad inválida', () => {
      const result = issueFormSchema.safeParse({ ...validBase, priority: 'critical' });
      expect(result.success).toBe(false);
    });
  });

  describe('coordenadas', () => {
    it('rechaza latitud fuera de rango', () => {
      const result = issueFormSchema.safeParse({
        ...validBase,
        coordinates: { lat: 91, lng: 0 },
      });
      expect(result.success).toBe(false);
    });

    it('rechaza longitud fuera de rango', () => {
      const result = issueFormSchema.safeParse({
        ...validBase,
        coordinates: { lat: 0, lng: 181 },
      });
      expect(result.success).toBe(false);
    });

    it('acepta coordinates null', () => {
      const result = issueFormSchema.safeParse({ ...validBase, coordinates: null });
      expect(result.success).toBe(true);
    });
  });
});
