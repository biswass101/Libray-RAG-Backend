import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login to get JWT access token' })
  @ApiResponse({ status: 200, description: 'Successful login' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request / Email taken' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the authenticated user password' })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid current password or authentication failed' })
  @ApiResponse({ status: 403, description: 'Demo accounts cannot change their password' })
  changePassword(@CurrentUser() user: { sub?: string; id?: string }, @Body() changePasswordDto: ChangePasswordDto) {
    const userId = user?.sub ?? user?.id;
    if (!userId) {
      throw new Error('Authenticated user id is missing');
    }
    return this.authService.changePassword(userId, changePasswordDto);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @ApiResponse({ status: 403, description: 'Demo accounts cannot modify their profile' })
  updateProfile(@CurrentUser() user: { sub?: string; id?: string }, @Body() updateProfileDto: UpdateProfileDto) {
    const userId = user?.sub ?? user?.id;
    if (!userId) {
      throw new Error('Authenticated user id is missing');
    }
    return this.authService.updateProfile(userId, updateProfileDto);
  }
}
