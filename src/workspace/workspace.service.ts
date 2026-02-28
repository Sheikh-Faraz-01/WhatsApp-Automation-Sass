import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';

@Injectable()
export class WorkspaceService {
    private readonly logger = new Logger(WorkspaceService.name);

    constructor(
        @InjectModel(Workspace.name) private readonly workspaceModel: Model<WorkspaceDocument>,
    ) { }

    /**
     * Look up a workspace by its Meta phone number ID.
     * Returns the lean document (with _id, phoneNumberId, name) or null if not found.
     */
    async findByPhoneNumberId(phoneNumberId: string): Promise<WorkspaceDocument | null> {
        return this.workspaceModel
            .findOne({ phoneNumberId })
            .select('_id phoneNumberId name')
            .lean()
            .exec() as Promise<WorkspaceDocument | null>;
    }
}

