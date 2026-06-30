-- CreateTable
CREATE TABLE `Round` (
    `id` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `circuitId` VARCHAR(191) NOT NULL,
    `roundNumber` INTEGER NOT NULL,
    `name` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Round_seasonId_idx`(`seasonId`),
    INDEX `Round_circuitId_idx`(`circuitId`),
    UNIQUE INDEX `Round_seasonId_roundNumber_key`(`seasonId`, `roundNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Round` ADD CONSTRAINT `Round_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Round` ADD CONSTRAINT `Round_circuitId_fkey` FOREIGN KEY (`circuitId`) REFERENCES `Circuit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
