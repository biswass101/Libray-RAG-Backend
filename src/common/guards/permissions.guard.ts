import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.roleId) {
      throw new ForbiddenException('Access denied. No role assigned.');
    }

    // Fetch user permissions
    const roleWithPermissions = await this.prisma.role.findUnique({
      where: { id: user.roleId },
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    });

    if (!roleWithPermissions) {
      throw new ForbiddenException('Access denied. Invalid role.');
    }

    const userPermissions = roleWithPermissions.permissions.map(p => p.permission.action);

    const hasPermission = requiredPermissions.some(permission => userPermissions.includes(permission));
    if (!hasPermission) {
      throw new ForbiddenException('Access denied. Missing required permissions.');
    }
    return true;
  }
}
