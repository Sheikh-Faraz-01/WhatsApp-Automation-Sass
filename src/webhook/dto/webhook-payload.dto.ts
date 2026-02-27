import { IsString, IsArray, ValidateNested, IsOptional, Equals, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class WebhookMetadataDto {
    @IsString()
    @IsNotEmpty()
    display_phone_number: string;

    @IsString()
    @IsNotEmpty()
    phone_number_id: string;
}

export class WebhookValueDto {
    @IsString()
    @IsNotEmpty()
    messaging_product: string;

    @ValidateNested()
    @Type(() => WebhookMetadataDto)
    metadata: WebhookMetadataDto;

    @IsOptional()
    @IsArray()
    messages?: any[];

    @IsOptional()
    @IsArray()
    contacts?: any[];

    @IsOptional()
    @IsArray()
    statuses?: any[];
}

export class WebhookChangeDto {
    @ValidateNested()
    @Type(() => WebhookValueDto)
    value: WebhookValueDto;

    @IsString()
    field: string;
}

export class WebhookEntryDto {
    @IsString()
    id: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => WebhookChangeDto)
    changes: WebhookChangeDto[];
}

export class WebhookPayloadDto {
    @Equals('whatsapp_business_account')
    object: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => WebhookEntryDto)
    entry: WebhookEntryDto[];
}
