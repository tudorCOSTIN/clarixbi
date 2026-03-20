import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BruteForceService } from '../services/brute-force.service';

@Injectable()
export class BruteForceGuard implements CanActivate {
  constructor(private readonly bruteForceService: BruteForceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;

    const blocked = await this.bruteForceService.isBlocked(ip);
    if (blocked) {
      throw new HttpException(
        'Too many failed login attempts. Your IP has been temporarily blocked. Please try again in 1 hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
