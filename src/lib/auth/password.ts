import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

/** Gera hash seguro de senha */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/** Verifica senha contra hash armazenado */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
