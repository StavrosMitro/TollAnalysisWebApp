-- ===========================================================================
-- Deterministic container init: SCHEMA (structure only).
-- This is a verbatim copy of ../Database_mysql/schema.sql (the original dump,
-- which is preserved untouched). It is executed automatically by the MySQL
-- container against the database named by MYSQL_DATABASE. Do not add USE /
-- CREATE DATABASE statements here.
-- Loaded before 02-data.sql.
-- ===========================================================================
-- MySQL dump 10.13  Distrib 8.0.40, for Linux (x86_64)
--
-- Host: localhost    Database: draft_b
-- ------------------------------------------------------
-- Server version	8.0.40-0ubuntu0.22.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Temporary view structure for view `ActiveDebtsWithDetails`
--

DROP TABLE IF EXISTS `ActiveDebtsWithDetails`;
/*!50001 DROP VIEW IF EXISTS `ActiveDebtsWithDetails`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `ActiveDebtsWithDetails` AS SELECT 
 1 AS `debt_id`,
 1 AS `toll_id`,
 1 AS `tagRef`,
 1 AS `debtor_company_id`,
 1 AS `debtor_company_name`,
 1 AS `creditor_company_id`,
 1 AS `creditor_company_name`,
 1 AS `toll_name`,
 1 AS `timestamp`,
 1 AS `amount`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `Company`
--

DROP TABLE IF EXISTS `Company`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Company` (
  `company_id` varchar(30) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(30) DEFAULT NULL,
  `no_tolls` int DEFAULT NULL,
  PRIMARY KEY (`company_id`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Debt`
--

DROP TABLE IF EXISTS `Debt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Debt` (
  `debt_id` int NOT NULL AUTO_INCREMENT,
  `toll_id` varchar(30) DEFAULT NULL,
  `tagRef` varchar(30) DEFAULT NULL,
  `debtor_company_id` varchar(30) DEFAULT NULL,
  `creditor_company_id` varchar(30) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `amount` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`debt_id`),
  KEY `toll_id` (`toll_id`),
  KEY `tagRef` (`tagRef`),
  KEY `debtor_company_id` (`debtor_company_id`),
  KEY `creditor_company_id` (`creditor_company_id`),
  CONSTRAINT `Debt_ibfk_1` FOREIGN KEY (`toll_id`) REFERENCES `Toll` (`Toll_id`),
  CONSTRAINT `Debt_ibfk_2` FOREIGN KEY (`tagRef`) REFERENCES `Transceiver` (`tagRef`),
  CONSTRAINT `Debt_ibfk_3` FOREIGN KEY (`debtor_company_id`) REFERENCES `Company` (`company_id`),
  CONSTRAINT `Debt_ibfk_4` FOREIGN KEY (`creditor_company_id`) REFERENCES `Company` (`company_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5837 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Passages`
--

DROP TABLE IF EXISTS `Passages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Passages` (
  `passage_id` int NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tollID` varchar(30) NOT NULL,
  `tagRef` varchar(30) NOT NULL,
  `tagHomeID` varchar(30) NOT NULL,
  `charge` decimal(5,2) NOT NULL,
  PRIMARY KEY (`passage_id`),
  UNIQUE KEY `same_passage` (`tollID`,`tagRef`,`timestamp`,`tagHomeID`,`charge`),
  KEY `tagRef` (`tagRef`),
  CONSTRAINT `Passages_ibfk_1` FOREIGN KEY (`tollID`) REFERENCES `Toll` (`Toll_id`),
  CONSTRAINT `Passages_ibfk_2` FOREIGN KEY (`tagRef`) REFERENCES `Transceiver` (`tagRef`)
) ENGINE=InnoDB AUTO_INCREMENT=16297 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Toll`
--

DROP TABLE IF EXISTS `Toll`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Toll` (
  `Toll_id` varchar(30) NOT NULL,
  `Latitude` decimal(8,5) DEFAULT NULL,
  `Longitude` decimal(8,5) NOT NULL,
  `Name` varchar(255) NOT NULL,
  `Locality` varchar(255) NOT NULL,
  `Road` varchar(255) NOT NULL,
  `Operator` varchar(255) DEFAULT NULL,
  `OpID` varchar(30) NOT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `Price1` decimal(5,2) NOT NULL,
  `Price2` decimal(5,2) NOT NULL,
  `Price3` decimal(5,2) NOT NULL,
  `Price4` decimal(5,2) NOT NULL,
  PRIMARY KEY (`Toll_id`),
  KEY `OpID` (`OpID`),
  CONSTRAINT `Toll_ibfk_1` FOREIGN KEY (`OpID`) REFERENCES `Company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `TotalDebts`
--

DROP TABLE IF EXISTS `TotalDebts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TotalDebts` (
  `debtor_company_id` varchar(30) NOT NULL,
  `creditor_company_id` varchar(30) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`debtor_company_id`,`creditor_company_id`),
  KEY `creditor_company_id` (`creditor_company_id`),
  CONSTRAINT `TotalDebts_ibfk_1` FOREIGN KEY (`debtor_company_id`) REFERENCES `Company` (`company_id`),
  CONSTRAINT `TotalDebts_ibfk_2` FOREIGN KEY (`creditor_company_id`) REFERENCES `Company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Transceiver`
--

DROP TABLE IF EXISTS `Transceiver`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Transceiver` (
  `tagRef` varchar(30) NOT NULL,
  `company_id` varchar(30) DEFAULT NULL,
  `balance` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`tagRef`),
  UNIQUE KEY `tagRef` (`tagRef`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `Transceiver_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `Company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `user_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_role` enum('admin','aodos','gefyra','egnatia','kentrikiodos','moreas','neaodos','olympiaodos') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_email` (`user_email`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Final view structure for view `ActiveDebtsWithDetails`
--

/*!50001 DROP VIEW IF EXISTS `ActiveDebtsWithDetails`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `ActiveDebtsWithDetails` AS select `D`.`debt_id` AS `debt_id`,`D`.`toll_id` AS `toll_id`,`D`.`tagRef` AS `tagRef`,`D`.`debtor_company_id` AS `debtor_company_id`,`DC`.`name` AS `debtor_company_name`,`D`.`creditor_company_id` AS `creditor_company_id`,`CC`.`name` AS `creditor_company_name`,`T`.`Name` AS `toll_name`,`D`.`timestamp` AS `timestamp`,`D`.`amount` AS `amount` from (((`Debt` `D` join `Company` `DC` on((`D`.`debtor_company_id` = `DC`.`company_id`))) join `Company` `CC` on((`D`.`creditor_company_id` = `CC`.`company_id`))) join `Toll` `T` on((`D`.`toll_id` = `T`.`Toll_id`))) where (`D`.`is_active` = 1) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-01-08 14:19:48
