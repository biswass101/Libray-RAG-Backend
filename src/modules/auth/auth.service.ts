import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { role: true }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.email, user.name, user.role.name);
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email }
    });

    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    // Default to 'member' role if exists, otherwise create it
    let defaultRole = await this.prisma.role.findUnique({ where: { name: 'admin' } });
    if (!defaultRole) {
      defaultRole = await this.prisma.role.create({
        data: { name: 'admin', description: 'System Administrator' }
      });
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        name: registerDto.name,
        roleId: defaultRole.id
      }
    });

    return this.generateTokens(user.id, user.email, user.name, defaultRole.name);
  }

  private generateTokens(userId: string, email: string, name: string, role: string) {
    const payload = { sub: userId, email, role };
    
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET') as string,
      expiresIn: '15m',
    });
    
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') as string,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        name,
        role
      }
    };
  }
}
