-- CreateTable
CREATE TABLE `locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `latitude` DECIMAL(7, 4) NOT NULL,
    `longitude` DECIMAL(7, 4) NOT NULL,
    `name` VARCHAR(255) NULL,
    `country` VARCHAR(8) NULL,
    `admin1` VARCHAR(255) NULL,
    `timezone` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `locations_latitude_longitude_key`(`latitude`, `longitude`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hourly_weather` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `location_id` INTEGER NOT NULL,
    `timestamp` DATETIME(0) NOT NULL,
    `source` ENUM('archive', 'forecast') NOT NULL,
    `fetched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `temperature_2m` DOUBLE NULL,
    `apparent_temperature` DOUBLE NULL,
    `relative_humidity_2m` INTEGER NULL,
    `precipitation` DOUBLE NULL,
    `rain` DOUBLE NULL,
    `snowfall` DOUBLE NULL,
    `pressure_msl` DOUBLE NULL,
    `cloud_cover` INTEGER NULL,
    `wind_speed_10m` DOUBLE NULL,
    `wind_direction_10m` INTEGER NULL,
    `wind_gusts_10m` DOUBLE NULL,
    `weather_code` INTEGER NULL,

    INDEX `hourly_weather_timestamp_idx`(`timestamp`),
    UNIQUE INDEX `hourly_weather_location_id_timestamp_key`(`location_id`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hourly_weather` ADD CONSTRAINT `hourly_weather_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
