-- CreateTable
CREATE TABLE `Driver` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `nationality` VARCHAR(191) NOT NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `cityOfBirth` VARCHAR(191) NULL,
    `countryOfBirth` VARCHAR(191) NULL,
    `racingNumber` INTEGER NULL,
    `nickname` VARCHAR(191) NULL,
    `shortBio` TEXT NULL,
    `officialWebsite` VARCHAR(191) NULL,
    `instagram` VARCHAR(191) NULL,
    `twitter` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'RETIRED', 'DECEASED', 'WITHOUT_SEAT') NOT NULL DEFAULT 'ACTIVE',
    `slug` VARCHAR(191) NOT NULL,
    `photoUrl` VARCHAR(191) NULL,
    `photoLicense` ENUM('CC0', 'CC_BY', 'CC_BY_SA') NULL,
    `photographerCredit` VARCHAR(191) NULL,
    `photoSourceUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Driver_slug_key`(`slug`),
    INDEX `Driver_slug_idx`(`slug`),
    INDEX `Driver_lastName_idx`(`lastName`),
    INDEX `Driver_nationality_idx`(`nationality`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Team` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `primaryColor` VARCHAR(191) NOT NULL,
    `secondaryColor` VARCHAR(191) NULL,
    `foundedYear` INTEGER NULL,
    `dissolvedYear` INTEGER NULL,
    `officialWebsite` VARCHAR(191) NULL,
    `instagram` VARCHAR(191) NULL,
    `twitter` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'MERGED', 'ACQUIRED') NOT NULL DEFAULT 'ACTIVE',
    `nameHistory` JSON NULL,
    `slug` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Team_slug_key`(`slug`),
    INDEX `Team_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Manufacturer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('ENGINE_SUPPLIER', 'CHASSIS_CONSTRUCTOR', 'BOTH') NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `website` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Manufacturer_name_key`(`name`),
    INDEX `Manufacturer_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Series` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `organiser` VARCHAR(191) NULL,
    `category` ENUM('SINGLE_SEATER', 'ENDURANCE', 'GT', 'TOURING', 'RALLY', 'OTHER') NOT NULL,
    `website` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `dataSource` ENUM('JOLPICA', 'OPENF1', 'COMMUNITY', 'MANUAL') NOT NULL DEFAULT 'COMMUNITY',
    `dataCoverage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Series_slug_key`(`slug`),
    INDEX `Series_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Season` (
    `id` VARCHAR(191) NOT NULL,
    `seriesId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `plannedRounds` INTEGER NULL,
    `actualRounds` INTEGER NULL,
    `status` ENUM('UPCOMING', 'ONGOING', 'FINISHED', 'CANCELLED') NOT NULL DEFAULT 'UPCOMING',
    `regulationUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Season_seriesId_idx`(`seriesId`),
    UNIQUE INDEX `Season_seriesId_year_key`(`seriesId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `seriesId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `abbreviation` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `hierarchy` INTEGER NOT NULL,
    `displayColor` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Category_seriesId_idx`(`seriesId`),
    UNIQUE INDEX `Category_seriesId_abbreviation_key`(`seriesId`, `abbreviation`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntryDriver` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `role` ENUM('TITULAR', 'REPLACEMENT', 'ENDURANCE_ONLY', 'GUEST') NOT NULL DEFAULT 'TITULAR',
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `wecClassification` ENUM('PLATINUM', 'GOLD', 'SILVER', 'BRONZE') NULL,

    INDEX `EntryDriver_driverId_idx`(`driverId`),
    INDEX `EntryDriver_entryId_idx`(`entryId`),
    UNIQUE INDEX `EntryDriver_entryId_driverId_key`(`entryId`, `driverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Entry` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `seasonId` VARCHAR(191) NOT NULL,
    `seriesId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `carNumber` VARCHAR(191) NOT NULL,
    `chassis` VARCHAR(191) NULL,
    `manufacturerId` VARCHAR(191) NULL,
    `status` ENUM('CONFIRMED', 'RUMOUR', 'CANCELLED', 'WITHDRAWN') NOT NULL DEFAULT 'CONFIRMED',
    `announcedAt` DATETIME(3) NULL,
    `sourceUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Entry_teamId_idx`(`teamId`),
    INDEX `Entry_seasonId_idx`(`seasonId`),
    INDEX `Entry_seriesId_idx`(`seriesId`),
    INDEX `Entry_categoryId_idx`(`categoryId`),
    INDEX `Entry_manufacturerId_idx`(`manufacturerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transfer` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `fromTeamId` VARCHAR(191) NULL,
    `toTeamId` VARCHAR(191) NULL,
    `fromSeriesId` VARCHAR(191) NULL,
    `toSeriesId` VARCHAR(191) NULL,
    `season` VARCHAR(191) NULL,
    `announcedAt` DATETIME(3) NULL,
    `effectiveAt` DATETIME(3) NULL,
    `status` ENUM('RUMOUR', 'CONFIRMED', 'OFFICIAL', 'CANCELLED') NOT NULL DEFAULT 'RUMOUR',
    `type` ENUM('TRANSFER', 'RETIREMENT', 'COMEBACK', 'REPLACEMENT', 'LOAN') NOT NULL DEFAULT 'TRANSFER',
    `sourceUrl` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Transfer_driverId_idx`(`driverId`),
    INDEX `Transfer_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Season` ADD CONSTRAINT `Season_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntryDriver` ADD CONSTRAINT `EntryDriver_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `Entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntryDriver` ADD CONSTRAINT `EntryDriver_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entry` ADD CONSTRAINT `Entry_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entry` ADD CONSTRAINT `Entry_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entry` ADD CONSTRAINT `Entry_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entry` ADD CONSTRAINT `Entry_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entry` ADD CONSTRAINT `Entry_manufacturerId_fkey` FOREIGN KEY (`manufacturerId`) REFERENCES `Manufacturer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_fromTeamId_fkey` FOREIGN KEY (`fromTeamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_toTeamId_fkey` FOREIGN KEY (`toTeamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_fromSeriesId_fkey` FOREIGN KEY (`fromSeriesId`) REFERENCES `Series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_toSeriesId_fkey` FOREIGN KEY (`toSeriesId`) REFERENCES `Series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
