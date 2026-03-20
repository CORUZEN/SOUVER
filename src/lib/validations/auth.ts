import { z } from 'zod'

export const loginSchema = z.object({
  login: z
    .string()
    .min(3, 'Login deve ter ao menos 3 caracteres.')
    .max(100, 'Login muito longo.'),
  password: z
    .string()
    .min(6, 'Senha deve ter ao menos 6 caracteres.'),
})

export const twoFactorSchema = z.object({
  userId: z.string().min(1, 'ID inválido.'),
  token: z
    .string()
    .length(6, 'Código deve ter 6 dígitos.')
    .regex(/^\d+$/, 'Código deve conter apenas dígitos.'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória.'),
    newPassword: z
      .string()
      .min(8, 'Nova senha deve ter ao menos 8 caracteres.')
      .regex(/[A-Z]/, 'Nova senha deve ter ao menos uma letra maiúscula.')
      .regex(/[0-9]/, 'Nova senha deve ter ao menos um número.'),
    confirmPassword: z.string().min(1, 'Confirmação é obrigatória.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type TwoFactorInput = z.infer<typeof twoFactorSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
