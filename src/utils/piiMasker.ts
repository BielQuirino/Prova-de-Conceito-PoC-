export function maskPhone(phone: string): string {
  if (phone.length < 8) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
