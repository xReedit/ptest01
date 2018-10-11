-- phpMyAdmin SQL Dump
-- version 3.5.2.2
-- http://www.phpmyadmin.net
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 05-06-2016 a las 09:34:37
-- Versión del servidor: 5.5.27
-- Versión de PHP: 5.4.7

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Base de datos: `restobar`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `carta`
--

CREATE TABLE IF NOT EXISTS `carta` (
  `idcarta` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `idcategoria` int(10) NOT NULL,
  `fecha` varchar(25) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idcarta`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=6 ;

--
-- Volcado de datos para la tabla `carta`
--

INSERT INTO `carta` (`idcarta`, `idorg`, `idsede`, `idcategoria`, `fecha`, `estado`) VALUES
(1, 1, 1, 1, '22/05/2016', 0),
(2, 1, 1, 1, '23/05/2016', 0),
(3, 1, 1, 1, '24/05/2016', 0),
(4, 1, 1, 1, '25/05/2016', 0),
(5, 1, 1, 1, '26/05/2016', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `carta_lista`
--

CREATE TABLE IF NOT EXISTS `carta_lista` (
  `idcarta_lista` char(20) NOT NULL,
  `idcarta` int(10) NOT NULL,
  `idseccion` int(10) NOT NULL,
  `iditem` int(10) NOT NULL,
  `precio` varchar(10) NOT NULL,
  `cantidad` char(10) NOT NULL,
  `cant_preparado` char(10) NOT NULL,
  `sec_orden` int(2) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idcarta_lista`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Volcado de datos para la tabla `carta_lista`
--

INSERT INTO `carta_lista` (`idcarta_lista`, `idcarta`, `idseccion`, `iditem`, `precio`, `cantidad`, `cant_preparado`, `sec_orden`, `estado`) VALUES
('11122205116', 1, 2, 1, '2.00', '25', '25', 0, 0),
('11122505116', 4, 2, 1, '2.00', '20', '20', 1, 0),
('11122605116', 5, 2, 1, '2.00', '20', '20', 1, 0),
('111742605116', 5, 4, 17, '7.00', '30', '30', 2, 0),
('111942205116', 1, 4, 19, '7.00', '10', '10', 0, 0),
('11222405116', 3, 2, 2, '1.00', '10', '10', 0, 0),
('11222505116', 4, 2, 2, '1.00', '25', '25', 1, 0),
('11222605116', 5, 2, 2, '1.00', '25', '25', 1, 0),
('112362505116', 4, 6, 23, '10.00', 'ND', 'ND', 4, 0),
('112362605116', 5, 6, 23, '10.00', 'ND', 'ND', 4, 0),
('112622205116', 1, 2, 26, '2.00', '8', '8', 0, 0),
('112742205116', 1, 4, 27, '10.00', '18', '18', 0, 0),
('112922605116', 5, 2, 29, '2.00', '30', '30', 1, 0),
('113722505116', 4, 2, 37, '2.00', '50', '50', 1, 0),
('114392405116', 3, 9, 43, '10.00', 'ND', 'ND', 0, 0),
('115442405116', 3, 4, 54, '8.00', '20', '20', 0, 0),
('115722405116', 3, 2, 57, '2.00', '20', '20', 0, 0),
('115842405116', 3, 4, 58, '9.00', '40', '40', 0, 0),
('115992405116', 3, 9, 59, '15.00', 'ND', 'ND', 0, 0),
('11622205116', 1, 2, 6, '2.00', '10', '10', 0, 0),
('116342605116', 5, 4, 63, '10.00', '30', '30', 2, 0),
('116942505116', 4, 4, 69, '10.00', '26', '26', 2, 0),
('1170122505116', 4, 12, 70, '10.00', 'ND', 'ND', 3, 0),
('1170122605116', 5, 12, 70, '10.00', 'ND', 'ND', 3, 0),
('1171122505116', 4, 12, 71, '16.00', 'ND', 'ND', 3, 0),
('1171122605116', 5, 12, 71, '16.00', 'ND', 'ND', 3, 0),
('117262505116', 4, 6, 72, '3.00', 'ND', 'ND', 4, 0),
('117262605116', 5, 6, 72, '3.00', 'ND', 'ND', 4, 0),
('117362505116', 4, 6, 73, '10.00', 'ND', 'ND', 4, 0),
('117362605116', 5, 6, 73, '10.00', 'ND', 'ND', 4, 0),
('117422605116', 5, 2, 74, '3.00', '20', '20', 1, 0),
('117542605116', 5, 4, 75, '8.00', '20', '20', 2, 0),
('117642605116', 5, 4, 76, '8.00', '30', '30', 2, 0),
('11842405116', 3, 4, 8, '7.00', '20', '20', 0, 0),
('11842505116', 4, 4, 8, '7.00', '19', '19', 2, 0),
('11942605116', 5, 4, 9, '7.00', '20', '20', 2, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categoria`
--

CREATE TABLE IF NOT EXISTS `categoria` (
  `idcategoria` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `descripcion` varchar(80) NOT NULL,
  `hora_ini` varchar(25) NOT NULL,
  `hora_fin` varchar(25) NOT NULL,
  `visible_x_hora` int(1) NOT NULL DEFAULT '0',
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idcategoria`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=2 ;

--
-- Volcado de datos para la tabla `categoria`
--

INSERT INTO `categoria` (`idcategoria`, `idorg`, `idsede`, `descripcion`, `hora_ini`, `hora_fin`, `visible_x_hora`, `estado`) VALUES
(1, 1, 1, 'ALMUERZO', '', '', 0, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `conf_print`
--

CREATE TABLE IF NOT EXISTS `conf_print` (
  `idconf_print` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `ip_print` varchar(80) NOT NULL,
  `num_copias` int(2) NOT NULL,
  `pie_pagina` varchar(200) NOT NULL,
  `logo` varchar(200) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idconf_print`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=2 ;

--
-- Volcado de datos para la tabla `conf_print`
--

INSERT INTO `conf_print` (`idconf_print`, `idorg`, `idsede`, `ip_print`, `num_copias`, `pie_pagina`, `logo`, `estado`) VALUES
(1, 1, 1, '192.168.1.80', 1, 'Gracias por su preferencia, estamos trabajando para brindarle un mejor servicio.', '11logo_sancarlos_print.jpg', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `conf_print_adicionales`
--

CREATE TABLE IF NOT EXISTS `conf_print_adicionales` (
  `idconf_print_adicionales` int(10) NOT NULL AUTO_INCREMENT,
  `idconf_print` int(10) NOT NULL,
  `descripcion` varchar(50) NOT NULL,
  `importe` varchar(5) NOT NULL,
  `idtipo_consumo` int(10) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idconf_print_adicionales`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `conf_print_detalle`
--

CREATE TABLE IF NOT EXISTS `conf_print_detalle` (
  `idconf_print_detalle` int(10) NOT NULL AUTO_INCREMENT,
  `idconf_print` int(10) NOT NULL,
  `descripcion` varchar(80) NOT NULL,
  `porcentaje` varchar(4) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idconf_print_detalle`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=3 ;

--
-- Volcado de datos para la tabla `conf_print_detalle`
--

INSERT INTO `conf_print_detalle` (`idconf_print_detalle`, `idconf_print`, `descripcion`, `porcentaje`, `estado`) VALUES
(1, 1, 'I.G.V', '18', 1),
(2, 1, 'SERVICIO', '8.5', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ie_caja`
--

CREATE TABLE IF NOT EXISTS `ie_caja` (
  `idie_caja` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `idusuario` int(10) NOT NULL,
  `tipo` int(1) NOT NULL COMMENT '1:ingreso 2:egreso',
  `motivo` varchar(255) NOT NULL,
  `fecha` varchar(30) NOT NULL,
  `monto` varchar(10) NOT NULL,
  `fecha_cierre` varchar(25) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idie_caja`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=4 ;

--
-- Volcado de datos para la tabla `ie_caja`
--

INSERT INTO `ie_caja` (`idie_caja`, `idorg`, `idsede`, `idusuario`, `tipo`, `motivo`, `fecha`, `monto`, `fecha_cierre`, `estado`) VALUES
(1, 1, 1, 1, 1, 'INGRESO DE EFECTIVO - SENCILLO', '09/05/2016 16:51:44', '75.00', '', 0),
(2, 1, 1, 1, 2, 'PAGO DE BOLETA 001-785 CECINA', '09/05/2016 16:53:24', '80.00', '', 0),
(3, 1, 1, 1, 2, 'PAGO DE GALLINA BOLETA 004-5521', '09/05/2016 16:55:05', '60.00', '', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `item`
--

CREATE TABLE IF NOT EXISTS `item` (
  `iditem` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `descripcion` varchar(80) NOT NULL,
  `precio` varchar(10) NOT NULL COMMENT 'ultimo precio',
  `detalle` varchar(255) NOT NULL,
  `img` varchar(255) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`iditem`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=77 ;

--
-- Volcado de datos para la tabla `item`
--

INSERT INTO `item` (`iditem`, `idorg`, `idsede`, `descripcion`, `precio`, `detalle`, `img`, `estado`) VALUES
(1, 1, 1, 'GELATINA', '2.00', '', '', 0),
(2, 1, 1, 'MASAMORRA', '1.00', '', '11altagastronomia.jpg', 0),
(3, 1, 1, 'FLAN', '1.00', '', '', 0),
(4, 1, 1, 'CAUSITA A LA HUANCAINA', '2.00', '', '', 0),
(5, 1, 1, 'CAUSA RELLENA', '2.00', '', '', 0),
(6, 1, 1, 'SOPA DE POLLO', '2.00', '', '', 0),
(7, 1, 1, 'MASAMORRA}', '1.00', '', '', 0),
(8, 1, 1, 'AJI DE GALLINA', '7.00', '', '11images (1).jpg', 0),
(9, 1, 1, 'LOMITO SALTADO', '7.00', '', '', 0),
(10, 1, 1, 'ENSALADA RUSA', '2.00', 'CON CREMA DE COCONA EE QQQ AAA EEE', '', 0),
(11, 1, 1, 'CECINA A LO POBRE', '7.00', '', '', 0),
(12, 1, 1, 'BISTEC ENCEBOLLADO', '7.00', '', '', 0),
(13, 1, 1, 'ASADO DE MAJAS', '10.00', '', '', 0),
(14, 1, 1, 'BISTEC A LO POBRE', '15.00', '', '', 0),
(15, 1, 1, 'AGUADITO', '2.00', '', '', 0),
(16, 1, 1, 'LOMO FINO ENROLLADO', '10.00', '', '', 0),
(17, 1, 1, 'CARAPULCRA DE CHANCHO Y POLLO Y MOLLEJAS', '7.00', '', '', 0),
(18, 1, 1, 'GALLINA GUISADA', '10.00', '', '', 0),
(19, 1, 1, 'CHICHARRON DE CHANCHO', '7.00', '', '', 0),
(20, 1, 1, 'MILANESA DE POLLO', '15.00', '', '', 0),
(21, 1, 1, 'TACACHO MIXTO', '15.00', '', '', 0),
(22, 1, 1, 'GUANABANA EN VASO', '2.00', '', '', 0),
(23, 1, 1, 'GUANABANA EN JARRA', '10.00', '', '', 0),
(24, 1, 1, 'COCACOLA 1/2 LITRO', '2.00', '', '', 0),
(25, 1, 1, 'INKA COLA 1/2 LITRO', '2.00', '', '', 0),
(26, 1, 1, 'OCOPA', '2.00', '', '', 0),
(27, 1, 1, 'ESCABECHE DE GALLINA', '10.00', '', '', 0),
(28, 1, 1, 'MAZAMORRA', '2.00', '', '', 0),
(29, 1, 1, 'SOPA DE RES', '2.00', '', '', 0),
(30, 1, 1, 'OOOOOOOOOOOOO', '10.00', '', '', 0),
(31, 1, 1, 'WWWWWWWWWWWWW', '15.00', '', '', 0),
(32, 1, 1, 'AAAAAAAAAAA', '15.00', '', '', 0),
(33, 1, 1, 'QQQQQQQQQQQQQQQQQQ', '12.00', '', '', 0),
(34, 1, 1, 'TILAPIA', '9.00', '', '', 0),
(35, 1, 1, 'PPPPP', '12.00', '', '', 0),
(36, 1, 1, 'CAUSA DE YUCA', '2.00', '', '', 0),
(37, 1, 1, 'SOPA DE ALBONDIGAS', '2.00', '', '', 0),
(38, 1, 1, 'ESCABECHE DE TILAPIA', '8.00', '', '', 0),
(39, 1, 1, 'UUUUUUUUU', '15.00', '', '', 0),
(40, 1, 1, 'QQQQQQQQQQQQQQQQQQQQQQQQQQQQQ', '15.00', '', '', 0),
(41, 1, 1, 'CREPE', '2.00', '', '', 0),
(42, 1, 1, 'CREPE DE POLLO', '8.00', '', '', 0),
(43, 1, 1, 'POPOPO', '10.00', '', '', 0),
(44, 1, 1, 'AJI EN SALSA DE CAYHUA', '18.00', '', '', 0),
(45, 1, 1, 'OOOIOI', '18.00', '', '', 0),
(46, 1, 1, 'ZAPALLO DE CHOCLO', '2.00', '', '', 0),
(47, 1, 1, 'TILAPIA FRITA', '8.00', '', '', 0),
(48, 1, 1, 'AJI DE PAICHE', '8.00', '', '', 0),
(49, 1, 1, 'AJI DE GALLINA GOURMET', '19.00', '', '', 0),
(50, 1, 1, 'POPOPOPOAAAA', '10.00', '', '', 0),
(51, 1, 1, 'EEEOO', '10.00', '', '', 0),
(52, 1, 1, 'SOPA DEL DIA', '2.00', '', '', 0),
(53, 1, 1, 'MAYORUNA', '2.00', '', '', 0),
(54, 1, 1, 'AJI CON POLLO', '8.00', '', '', 0),
(55, 1, 1, 'UUUPPPPOO', '10.00', '', '', 0),
(56, 1, 1, 'NDDDD', '10.00', '', '', 0),
(57, 1, 1, 'MOCOR ARROZ', '2.00', '', '', 0),
(58, 1, 1, 'AJE CON PAPA', '9.00', '', '', 0),
(59, 1, 1, 'OCOCOCOC', '15.00', '', '', 0),
(60, 1, 1, 'SOPA MENESTRON', '2.00', '', '', 0),
(61, 1, 1, 'FLAN CONBINADO', '2.00', '', '', 0),
(62, 1, 1, 'MANGO CON SAL', '2.00', '', '', 0),
(63, 1, 1, 'INCHIQUIAPO', '10.00', '', '', 0),
(64, 1, 1, 'CHOCLO DORADO', '8.00', '', '', 0),
(65, 1, 1, 'AJI ESCABECHE CON PALTA', '10.00', '', '', 0),
(66, 1, 1, 'MEDIO ROCOT', '5.00', '', '', 0),
(67, 1, 1, 'ROCOCOCO', '10.00', '', '', 0),
(68, 1, 1, 'PPOYOYUYU', '20.00', '', '', 0),
(69, 1, 1, 'AJI DE POLLO', '10.00', '', '', 0),
(70, 1, 1, 'YOYOYO', '10.00', '', '', 0),
(71, 1, 1, 'CORTE BASICO', '16.00', '', '', 0),
(72, 1, 1, '1/2 JARRA DEL MENU', '3.00', '', '', 0),
(73, 1, 1, 'JARRA DE CHICHA', '10.00', '', '', 0),
(74, 1, 1, 'COCO RALLADO', '3.00', '', '', 0),
(75, 1, 1, 'AJI EN SALSA DE SILLAO', '8.00', '', '', 0),
(76, 1, 1, 'ASADO DE RES', '8.00', '', '', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `org`
--

CREATE TABLE IF NOT EXISTS `org` (
  `idorg` int(10) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) NOT NULL,
  `direccion` varchar(200) NOT NULL,
  `ruc` varchar(20) NOT NULL,
  `telefono` varchar(200) NOT NULL,
  `email` varchar(200) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idorg`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=2 ;

--
-- Volcado de datos para la tabla `org`
--

INSERT INTO `org` (`idorg`, `nombre`, `direccion`, `ruc`, `telefono`, `email`, `estado`) VALUES
(1, 'SAN CARLOS EIRL', 'JR REYES GUERRA C 7', '', '', '', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedido`
--

CREATE TABLE IF NOT EXISTS `pedido` (
  `idpedido` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `idcliente` int(10) NOT NULL,
  `fecha` varchar(25) NOT NULL,
  `hora` varchar(25) NOT NULL,
  `nummesa` int(10) NOT NULL,
  `numpedido` int(10) NOT NULL,
  `correlativo_dia` int(4) NOT NULL,
  `reserva` int(1) NOT NULL DEFAULT '0',
  `referencia` varchar(50) NOT NULL,
  `total` varchar(10) NOT NULL,
  `tiempo_atencion` varchar(50) NOT NULL COMMENT 'desde pedido hasta despacho',
  `fecha_cierre` varchar(25) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0' COMMENT '0: nuevo, 1:despachado, 2:pagado 3:anulado',
  PRIMARY KEY (`idpedido`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=13 ;

--
-- Volcado de datos para la tabla `pedido`
--

INSERT INTO `pedido` (`idpedido`, `idorg`, `idsede`, `idcliente`, `fecha`, `hora`, `nummesa`, `numpedido`, `correlativo_dia`, `reserva`, `referencia`, `total`, `tiempo_atencion`, `fecha_cierre`, `estado`) VALUES
(1, 1, 1, 0, '18/05/2016', '19:45:56', 25, 1, 0, 0, '', '17.00', '', '', 0),
(2, 1, 1, 0, '18/05/2016', '19:46:56', 14, 2, 0, 0, '', '7.00', '', '', 0),
(3, 1, 1, 0, '18/05/2016', '19:49:45', 11, 3, 0, 0, '', '10.00', '', '', 0),
(4, 1, 1, 0, '18/05/2016', '20:00:40', 15, 4, 0, 0, '', '7.00', '', '', 0),
(5, 1, 1, 0, '18/05/2016', '20:03:55', 17, 5, 0, 0, '', '7.00', '', '', 0),
(6, 1, 1, 0, '18/05/2016', '20:05:34', 17, 6, 0, 0, '', '24.00', '', '', 0),
(7, 1, 1, 0, '18/05/2016', '20:06:59', 17, 7, 0, 0, '', '24.00', '', '', 0),
(8, 1, 1, 0, '22/05/2016', '21:32:33', 2, 8, 1, 0, '', '12.00', '', '', 0),
(9, 1, 1, 0, '22/05/2016', '21:34:27', 2, 9, 2, 0, '', '12.00', '', '', 0),
(10, 1, 1, 0, '25/05/2016', '00:24:10', 45, 10, 1, 0, '', '10.00', '', '', 0),
(11, 1, 1, 0, '25/05/2016', '00:39:13', 5, 11, 2, 0, '', '26.00', '', '', 0),
(12, 1, 1, 0, '25/05/2016', '01:44:42', 10, 12, 3, 0, '', '53.00', '', '', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedido_detalle`
--

CREATE TABLE IF NOT EXISTS `pedido_detalle` (
  `idpedido_detalle` int(10) NOT NULL AUTO_INCREMENT,
  `idpedido` int(10) NOT NULL,
  `idtipo_consumo` int(10) NOT NULL,
  `idcategoria` int(10) NOT NULL,
  `idcarta_lista` varchar(20) NOT NULL,
  `iditem` int(10) NOT NULL,
  `idseccion` int(10) NOT NULL,
  `cantidad` varchar(5) NOT NULL,
  `punitario` varchar(5) NOT NULL,
  `ptotal` varchar(5) NOT NULL,
  `descripcion` varchar(200) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idpedido_detalle`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=30 ;

--
-- Volcado de datos para la tabla `pedido_detalle`
--

INSERT INTO `pedido_detalle` (`idpedido_detalle`, `idpedido`, `idtipo_consumo`, `idcategoria`, `idcarta_lista`, `iditem`, `idseccion`, `cantidad`, `punitario`, `ptotal`, `descripcion`, `estado`) VALUES
(1, 1, 1, 1, '111021705116', 10, 2, '01', '2.00', '2.00', 'ENSALADA RUSA ', 0),
(2, 1, 1, 1, '112051705116', 20, 5, '01', '15.00', '15.00', 'MILANESA DE POLLO ', 0),
(3, 2, 1, 1, '11221705116', 2, 2, '01', '1.00', '0.00', 'MASAMORRA ', 0),
(4, 2, 1, 1, '111941705116', 19, 4, '01', '7.00', '7.00', 'CHICHARRON DE CHANCHO ', 0),
(5, 3, 1, 1, '111021705116', 10, 2, '01', '2.00', '0.00', 'ENSALADA RUSA ', 0),
(6, 3, 1, 1, '111341705116', 13, 4, '01', '10.00', '10.00', 'ASADO DE MAJAS ', 0),
(7, 4, 1, 1, '111021705116', 10, 2, '01', '2.00', '0.00', 'ENSALADA RUSA ', 0),
(8, 4, 1, 1, '111741705116', 17, 4, '01', '7.00', '7.00', 'CARAPULCRA DE CHANCHO Y POLLO Y MOLLEJAS ', 0),
(9, 5, 1, 1, '111021705116', 10, 2, '01', '2.00', '0.00', 'ENSALADA RUSA ', 0),
(10, 5, 1, 1, '111741705116', 17, 4, '01', '7.00', '7.00', 'CARAPULCRA DE CHANCHO Y POLLO Y MOLLEJAS ', 0),
(11, 6, 1, 1, '111021705116', 10, 2, '02', '2.00', '2.00', 'ENSALADA RUSA ', 0),
(12, 6, 1, 1, '111741705116', 17, 4, '01', '7.00', '7.00', 'CARAPULCRA DE CHANCHO Y POLLO Y MOLLEJAS ', 0),
(13, 6, 1, 1, '111451705116', 14, 5, '01', '15.00', '15.00', 'BISTEC A LO POBRE ', 0),
(14, 7, 1, 1, '111021705116', 10, 2, '02', '2.00', '2.00', 'ENSALADA RUSA ', 0),
(15, 7, 1, 1, '111741705116', 17, 4, '01', '7.00', '7.00', 'CARAPULCRA DE CHANCHO Y POLLO Y MOLLEJAS ', 0),
(16, 7, 1, 1, '111451705116', 14, 5, '01', '15.00', '15.00', 'BISTEC A LO POBRE ', 0),
(17, 8, 1, 1, '11122205116', 1, 2, '01', '2.00', '0.00', 'GELATINA ', 0),
(18, 8, 1, 1, '112622205116', 26, 2, '01', '2.00', '2.00', 'OCOPA ', 0),
(19, 8, 1, 1, '112742205116', 27, 4, '01', '10.00', '10.00', 'ESCABECHE DE GALLINA ', 0),
(20, 9, 1, 1, '11122205116', 1, 2, '01', '2.00', '0.00', 'GELATINA ', 0),
(21, 9, 1, 1, '112622205116', 26, 2, '01', '2.00', '2.00', 'OCOPA ', 0),
(22, 9, 1, 1, '112742205116', 27, 4, '01', '10.00', '10.00', 'ESCABECHE DE GALLINA ', 0),
(23, 10, 1, 1, '116222505116', 62, 2, '01', '2.00', '0.00', 'MANGO CON SAL ', 0),
(24, 10, 1, 1, '111342505116', 13, 4, '01', '10.00', '10.00', 'ASADO DE MAJAS ', 0),
(25, 11, 1, 1, '11122505116', 1, 2, '09', '2.00', '16.00', 'GELATINA ', 0),
(26, 11, 1, 1, '116542505116', 65, 4, '01', '10.00', '10.00', 'AJI ESCABECHE CON PALTA ', 0),
(27, 12, 1, 1, '113722505116', 37, 2, '08', '2.00', '6.00', 'SOPA DE ALBONDIGAS ', 0),
(28, 12, 1, 1, '116942505116', 69, 4, '04', '10.00', '40.00', 'AJI DE POLLO ', 0),
(29, 12, 1, 1, '11842505116', 8, 4, '01', '7.00', '7.00', 'AJI DE GALLINA ', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedido_pago`
--

CREATE TABLE IF NOT EXISTS `pedido_pago` (
  `idpedido_pago` int(10) NOT NULL AUTO_INCREMENT,
  `idpedido` int(10) NOT NULL,
  `idtipo_pago` int(10) NOT NULL,
  `importe` varchar(20) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idpedido_pago`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `regla_carta`
--

CREATE TABLE IF NOT EXISTS `regla_carta` (
  `idregla_carta` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `idcategoria` int(10) NOT NULL,
  `idseccion` int(10) NOT NULL,
  `idseccion_detalle` int(10) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idregla_carta`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=2 ;

--
-- Volcado de datos para la tabla `regla_carta`
--

INSERT INTO `regla_carta` (`idregla_carta`, `idorg`, `idsede`, `idcategoria`, `idseccion`, `idseccion_detalle`, `estado`) VALUES
(1, 1, 1, 1, 4, 2, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `seccion`
--

CREATE TABLE IF NOT EXISTS `seccion` (
  `idseccion` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `descripcion` varchar(80) NOT NULL,
  `imprimir` int(1) NOT NULL DEFAULT '0' COMMENT '1:no mostrar al imprimir',
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idseccion`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=13 ;

--
-- Volcado de datos para la tabla `seccion`
--

INSERT INTO `seccion` (`idseccion`, `idorg`, `idsede`, `descripcion`, `imprimir`, `estado`) VALUES
(2, 1, 1, 'ENTRADA', 0, 0),
(4, 1, 1, 'PLATOS DE FONDO', 0, 0),
(5, 1, 1, 'PLATOS A LA CARTA', 0, 0),
(6, 1, 1, 'BEBIDAS', 1, 0),
(7, 1, 1, 'GASEOSAS', 1, 0),
(9, 1, 1, 'UPUPUPUOOP', 0, 0),
(10, 1, 1, 'ROCOTO', 0, 0),
(11, 1, 1, 'UTUTUTUT', 0, 0),
(12, 1, 1, 'YUYUYU', 1, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sede`
--

CREATE TABLE IF NOT EXISTS `sede` (
  `idsede` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `direccion` varchar(255) NOT NULL,
  `eslogan` varchar(80) NOT NULL,
  `mesas` varchar(4) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idsede`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=2 ;

--
-- Volcado de datos para la tabla `sede`
--

INSERT INTO `sede` (`idsede`, `idorg`, `nombre`, `direccion`, `eslogan`, `mesas`, `estado`) VALUES
(1, 1, 'SAN CARLOS', 'SAN MARTIN / MOYOBAMBA', 'TRADICION DESDE 1997. BIENVENIDOS.', '42', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tipo_consumo`
--

CREATE TABLE IF NOT EXISTS `tipo_consumo` (
  `idtipo_consumo` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `descripcion` varchar(30) NOT NULL,
  `titulo` varchar(50) NOT NULL COMMENT 'titulo que imprime en el ticket',
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idtipo_consumo`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=3 ;

--
-- Volcado de datos para la tabla `tipo_consumo`
--

INSERT INTO `tipo_consumo` (`idtipo_consumo`, `idorg`, `idsede`, `descripcion`, `titulo`, `estado`) VALUES
(1, 1, 1, 'CONSUMIR EN EL LOCAL', '', 0),
(2, 1, 1, 'PARA LLEVAR', 'LLEVAR', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tipo_pago`
--

CREATE TABLE IF NOT EXISTS `tipo_pago` (
  `idtipo_pago` int(10) NOT NULL AUTO_INCREMENT,
  `descripcion` varchar(30) NOT NULL,
  `estado` int(10) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idtipo_pago`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=4 ;

--
-- Volcado de datos para la tabla `tipo_pago`
--

INSERT INTO `tipo_pago` (`idtipo_pago`, `descripcion`, `estado`) VALUES
(1, 'CONTADO', 0),
(2, 'TARJETA', 0),
(3, 'CREDITO', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

CREATE TABLE IF NOT EXISTS `usuario` (
  `idusuario` int(10) NOT NULL AUTO_INCREMENT,
  `idorg` int(10) NOT NULL,
  `idsede` int(10) NOT NULL,
  `nombres` varchar(255) NOT NULL,
  `cargo` varchar(80) NOT NULL,
  `usuario` varchar(20) NOT NULL,
  `pass` varchar(20) NOT NULL,
  `acc` varchar(255) NOT NULL,
  `per` varchar(20) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idusuario`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=5 ;

--
-- Volcado de datos para la tabla `usuario`
--

INSERT INTO `usuario` (`idusuario`, `idorg`, `idsede`, `nombres`, `cargo`, `usuario`, `pass`, `acc`, `per`, `estado`) VALUES
(1, 1, 1, 'MARCEL RAMIREZ', 'ADM GERENTE', 'mramirez', '123456', 'ABCDEF', 'ABCD', 0),
(2, 1, 1, 'ARMANDO JUNIOR', 'ASISTENTE DE CAJA', 'jramirez', '123456', 'ABCD', '', 0),
(3, 1, 1, 'ARMANDO RAMIREZ', 'ASISTENTE DE CAJA', 'aramirez', '123456', 'ABCD', 'PAPBPCPD', 0),
(4, 1, 1, 'ORLANDO', 'ANFITRION', 'odiaz', '123456', 'B', '', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario_tipo`
--

CREATE TABLE IF NOT EXISTS `usuario_tipo` (
  `idusuario_tipo` int(2) NOT NULL AUTO_INCREMENT,
  `descripcion` varchar(30) NOT NULL,
  `acc` varchar(80) NOT NULL,
  `estado` int(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`idusuario_tipo`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1 AUTO_INCREMENT=3 ;

--
-- Volcado de datos para la tabla `usuario_tipo`
--

INSERT INTO `usuario_tipo` (`idusuario_tipo`, `descripcion`, `acc`, `estado`) VALUES
(1, 'ADMIN GENERAL', '', 0),
(2, 'ADMINISTRADOR', '', 0);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
