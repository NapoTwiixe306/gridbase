-- CreateTable
CREATE TABLE `Circuit` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `type` ENUM('PERMANENT', 'STREET', 'OVAL', 'ROAD') NOT NULL DEFAULT 'PERMANENT',
    `lengthKm` DOUBLE NULL,
    `turns` INTEGER NULL,
    `openedYear` INTEGER NULL,
    `website` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Circuit_slug_key`(`slug`),
    INDEX `Circuit_slug_idx`(`slug`),
    INDEX `Circuit_country_idx`(`country`),
    INDEX `Circuit_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
