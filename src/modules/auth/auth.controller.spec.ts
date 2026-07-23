import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  it('passes the authenticated user id to changePassword', async () => {
    const changePassword = jest.fn().mockResolvedValue({ message: 'Password updated successfully' });
    const authService = { changePassword } as unknown as AuthService;
    const controller = new AuthController(authService);

    const result = await controller.changePassword(
      { id: 'user-123' } as any,
      { currentPassword: 'admin123', newPassword: '2026@Niloy' },
    );

    expect(changePassword).toHaveBeenCalledWith('user-123', {
      currentPassword: 'admin123',
      newPassword: '2026@Niloy',
    });
    expect(result).toEqual({ message: 'Password updated successfully' });
  });
});
