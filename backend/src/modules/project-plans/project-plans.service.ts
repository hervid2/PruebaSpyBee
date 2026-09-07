import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../lib/s3/storage-provider.interface';
import { PresignProjectPlanUploadDto } from './dto/presign-project-plan-upload.dto';
import { CreateProjectPlanDto } from './dto/create-project-plan.dto';
import { PresignedUploadDto } from '../media/dto/presigned-upload.dto';
import {
  ProjectPlanResponseDto,
  toProjectPlanResponseDto,
} from './dto/project-plan-response.dto';
import {
  MAX_PROJECT_PLAN_SIZE_BYTES,
  projectPlanFormatFromContentType,
  projectPlanTypeFromContentType,
} from './project-plans.constants';

@Injectable()
export class ProjectPlansService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async presignUpload(
    projectId: string,
    dto: PresignProjectPlanUploadDto,
    user: AuthenticatedUser,
  ): Promise<PresignedUploadDto> {
    await this.assertProjectInOrg(projectId, user);

    if (!projectPlanTypeFromContentType(dto.contentType)) {
      throw new BadRequestException(
        `Unsupported content type: ${dto.contentType}`,
      );
    }
    if (dto.size > MAX_PROJECT_PLAN_SIZE_BYTES) {
      throw new BadRequestException(
        'File exceeds the maximum size allowed for project plans',
      );
    }

    const key = `${planKeyPrefix(projectId)}${randomUUID()}-${sanitizeFilename(dto.filename)}`;
    // Signed size, so the cap binds the upload and not just the claim (F9.5).
    return this.storage.getPresignedUploadUrl(key, dto.contentType, dto.size);
  }

  async create(
    projectId: string,
    dto: CreateProjectPlanDto,
    user: AuthenticatedUser,
  ): Promise<ProjectPlanResponseDto> {
    await this.assertProjectInOrg(projectId, user);

    // Same reasoning as `MediaService.create` (F9.4): `fileUrl` is client
    // text, and a plan's URL is rendered as a link/preview and used to pick
    // the object to delete, so it is checked before it is stored.
    const key = this.storage.resolveOwnKey(
      dto.fileUrl,
      planKeyPrefix(projectId),
    );
    if (!key) {
      throw new BadRequestException(
        'fileUrl must be an upload URL issued for this project',
      );
    }

    // And, as in `MediaService.create` (F9.5), the row is written from the
    // object rather than from the request that claims to describe it.
    const object = await this.storage.headObject(key);
    if (!object) {
      throw new BadRequestException('No file has been uploaded to that URL');
    }

    const contentType = object.contentType ?? '';
    const planType = projectPlanTypeFromContentType(contentType);
    if (!planType) {
      throw new BadRequestException(
        `Unsupported content type: ${contentType || 'none'}`,
      );
    }
    if (object.size > MAX_PROJECT_PLAN_SIZE_BYTES) {
      throw new BadRequestException(
        'File exceeds the maximum size allowed for project plans',
      );
    }

    const plan = await this.prisma.projectPlan.create({
      data: {
        projectId,
        name: dto.name,
        type: planType,
        format: projectPlanFormatFromContentType(contentType),
        size: object.size,
        url: this.storage.publicUrlForKey(key),
      },
    });
    return toProjectPlanResponseDto(plan);
  }

  async list(
    projectId: string,
    user: AuthenticatedUser,
  ): Promise<ProjectPlanResponseDto[]> {
    await this.assertProjectInOrg(projectId, user);

    const plans = await this.prisma.projectPlan.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return plans.map(toProjectPlanResponseDto);
  }

  async remove(planId: string, user: AuthenticatedUser): Promise<void> {
    const plan = await this.prisma.projectPlan.findUnique({
      where: { id: planId },
      include: { project: true },
    });
    if (!plan) throw new NotFoundException();
    if (user.role !== 'superadmin' && plan.project.orgId !== user.orgId) {
      throw new NotFoundException();
    }

    const key = this.storage.resolveOwnKey(
      plan.url,
      planKeyPrefix(plan.projectId),
    );
    if (key) {
      await this.storage.deleteObject(key);
    }
    await this.prisma.projectPlan.delete({ where: { id: plan.id } });
  }

  private async assertProjectInOrg(
    projectId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException();
    if (user.role !== 'superadmin' && project.orgId !== user.orgId) {
      throw new NotFoundException();
    }
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** The single key namespace a project's plans may live under — signed on the way out, required on the way back. */
function planKeyPrefix(projectId: string): string {
  return `projects/${projectId}/plans/`;
}
