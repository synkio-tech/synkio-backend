import { IsString, IsEmail, IsOptional, IsNumber, IsArray, IsBoolean, ValidateIf, Matches, Min, Max, MaxLength, MinLength, Validate, IsObject, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ethers } from 'ethers';
import { sanitizeEmail, containsScriptTags } from '../utils/sanitize';

class IsEthereumAddressConstraint {
  validate(value: any): boolean {
    return typeof value === 'string' && ethers.isAddress(value);
  }
  
  defaultMessage(): string {
    return 'Invalid Ethereum address';
  }
}

class IsSafeContentConstraint {
  validate(value: any): boolean {
    if (!value) return true;
    const jsonStr = typeof value === 'string' ? value : JSON.stringify(value);
    return !jsonStr.match(/<script|javascript:|on\w+\s*=/i);
  }
  
  defaultMessage(): string {
    return 'Invalid characters detected';
  }
}

export class MilestoneDto {
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'Amount must be a valid number string' })
  amount!: string;

  @IsString()
  @MinLength(1, { message: 'Milestone description is required' })
  @MaxLength(500, { message: 'Description too long' })
  description!: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsNumber()
  completedAt?: number;
}

export class MetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Title too long' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Description too long' })
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  milestones?: MilestoneDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^https?:\/\/.+/, { each: true, message: 'Invalid image URL' })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}

export class CreateEscrowDto {
  @Validate(IsEthereumAddressConstraint)
  @IsString()
  seller!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'Amount must be a valid number string' })
  amount!: string;

  @IsOptional()
  @ValidateIf((o) => o.tokenAddress !== '')
  @Validate(IsEthereumAddressConstraint)
  @IsString()
  tokenAddress?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid buyer email' })
  @Transform(({ value }) => value ? sanitizeEmail(value) : undefined)
  buyerEmail?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid seller email' })
  @Transform(({ value }) => value ? sanitizeEmail(value) : undefined)
  sellerEmail?: string;

  @IsOptional()
  @Type(() => MetadataDto)
  @Validate(IsSafeContentConstraint)
  metadata?: MetadataDto;

  @IsOptional()
  @IsObject()
  @Validate(IsSafeContentConstraint)
  conversationContext?: Record<string, any>;
}

export class ReleaseEscrowDto {
  @IsString()
  @Matches(/^\d+$/, { message: 'Escrow ID must be a number' })
  escrowId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  milestoneIndex?: number;
}

export class RefundEscrowDto {
  @IsString()
  @Matches(/^\d+$/, { message: 'Escrow ID must be a number' })
  escrowId!: string;
}

export class DisputeEscrowDto {
  @IsString()
  @Matches(/^\d+$/, { message: 'Escrow ID must be a number' })
  escrowId!: string;

  @IsString()
  @MinLength(1, { message: 'Dispute reason is required' })
  @MaxLength(1000, { message: 'Reason too long' })
  reason!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  evidence?: string[];
}

export class GetEscrowDto {
  @IsString()
  @Matches(/^\d+$/, { message: 'Escrow ID must be a number' })
  escrowId!: string;
}

