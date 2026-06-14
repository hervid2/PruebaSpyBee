import { z } from 'zod';

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const issueFormSchema = z.object({
  title: z
    .string()
    .min(1, 'El título es obligatorio')
    .max(120, 'El título no puede superar los 120 caracteres'),

  description: z
    .string()
    .min(1, 'La descripción es obligatoria')
    .max(1000, 'La descripción no puede superar los 1000 caracteres'),

  dueDate: z
    .string()
    .min(1, 'La fecha de vencimiento es obligatoria')
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date >= today();
    }, 'La fecha de vencimiento no puede ser anterior a hoy'),

  typeId: z.string().min(1, 'La categoría es obligatoria'),

  priority: z.enum(['high', 'medium', 'low'], {
    error: () => ({ message: 'Selecciona una prioridad' }),
  }),

  tagIds: z.array(z.string()).optional(),

  assigneeIds: z.array(z.string()).optional(),

  observerIds: z.array(z.string()).optional(),

  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable()
    .optional(),

  locationDescription: z.string().max(500).nullable().optional(),
});

export type IssueFormValues = z.infer<typeof issueFormSchema>;
