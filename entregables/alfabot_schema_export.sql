--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: diagnosticos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnosticos (
    id integer NOT NULL,
    evaluacion_id integer NOT NULL,
    modulo_id integer NOT NULL,
    regla_id integer NOT NULL,
    fecha timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: diagnosticos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.diagnosticos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: diagnosticos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.diagnosticos_id_seq OWNED BY public.diagnosticos.id;


--
-- Name: evaluaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluaciones (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    fecha_inicio timestamp without time zone DEFAULT now() NOT NULL,
    fecha_fin timestamp without time zone,
    estado character varying(20) DEFAULT 'en_curso'::character varying NOT NULL,
    CONSTRAINT evaluaciones_estado_check CHECK (((estado)::text = ANY ((ARRAY['en_curso'::character varying, 'completada'::character varying])::text[])))
);


--
-- Name: evaluaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluaciones_id_seq OWNED BY public.evaluaciones.id;


--
-- Name: hipotesis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hipotesis (
    id integer NOT NULL,
    codigo character varying(3) NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text NOT NULL,
    nivel integer NOT NULL,
    prior numeric(5,4) NOT NULL,
    CONSTRAINT hipotesis_prior_check CHECK (((prior > (0)::numeric) AND (prior < (1)::numeric)))
);


--
-- Name: hipotesis_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hipotesis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hipotesis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hipotesis_id_seq OWNED BY public.hipotesis.id;


--
-- Name: inferencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inferencias (
    id integer NOT NULL,
    evaluacion_id integer NOT NULL,
    paso integer NOT NULL,
    hipotesis_id integer NOT NULL,
    rama_id integer,
    probabilidad numeric(7,6) NOT NULL
);


--
-- Name: inferencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inferencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inferencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inferencias_id_seq OWNED BY public.inferencias.id;


--
-- Name: intentos_ejercicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intentos_ejercicio (
    id integer NOT NULL,
    ruta_leccion_id integer NOT NULL,
    objetivo character varying(40) NOT NULL,
    correcto boolean NOT NULL,
    fecha timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: intentos_ejercicio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.intentos_ejercicio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intentos_ejercicio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.intentos_ejercicio_id_seq OWNED BY public.intentos_ejercicio.id;


--
-- Name: lecciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lecciones (
    id integer NOT NULL,
    modulo_id integer NOT NULL,
    codigo character varying(5) NOT NULL,
    titulo character varying(80) NOT NULL,
    explicacion text NOT NULL,
    tipo_ejercicio character varying(30) NOT NULL,
    parametros jsonb DEFAULT '{}'::jsonb NOT NULL,
    orden integer NOT NULL
);


--
-- Name: lecciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lecciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lecciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lecciones_id_seq OWNED BY public.lecciones.id;


--
-- Name: lecciones_reglas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lecciones_reglas (
    leccion_id integer NOT NULL,
    regla_id integer NOT NULL
);


--
-- Name: modulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modulos (
    id integer NOT NULL,
    codigo character varying(2) NOT NULL,
    nombre character varying(100) NOT NULL,
    orden integer NOT NULL
);


--
-- Name: modulos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.modulos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: modulos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.modulos_id_seq OWNED BY public.modulos.id;


--
-- Name: nodos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nodos (
    id integer NOT NULL,
    modulo_id integer NOT NULL,
    codigo character varying(5) NOT NULL,
    pregunta text NOT NULL,
    orden integer NOT NULL
);


--
-- Name: nodos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nodos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nodos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nodos_id_seq OWNED BY public.nodos.id;


--
-- Name: progreso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progreso (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    modulo_id integer NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT progreso_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'en_curso'::character varying, 'superado'::character varying])::text[])))
);


--
-- Name: progreso_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.progreso_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: progreso_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.progreso_id_seq OWNED BY public.progreso.id;


--
-- Name: ramas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ramas (
    id integer NOT NULL,
    nodo_id integer NOT NULL,
    codigo character varying(10) NOT NULL,
    condicion text NOT NULL,
    es_avance boolean DEFAULT false NOT NULL,
    siguiente_nodo_id integer
);


--
-- Name: ramas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ramas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ramas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ramas_id_seq OWNED BY public.ramas.id;


--
-- Name: reglas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reglas (
    id integer NOT NULL,
    rama_id integer NOT NULL,
    codigo character varying(6) NOT NULL,
    condicion_texto text NOT NULL,
    accion_texto text NOT NULL,
    tipo character varying(10) NOT NULL,
    CONSTRAINT reglas_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['avance'::character varying, 'remedial'::character varying, 'fin'::character varying])::text[])))
);


--
-- Name: reglas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reglas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reglas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reglas_id_seq OWNED BY public.reglas.id;


--
-- Name: respuestas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.respuestas (
    id integer NOT NULL,
    evaluacion_id integer NOT NULL,
    nodo_id integer NOT NULL,
    rama_id integer NOT NULL,
    fecha timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: respuestas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.respuestas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: respuestas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.respuestas_id_seq OWNED BY public.respuestas.id;


--
-- Name: ruta_lecciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ruta_lecciones (
    id integer NOT NULL,
    ruta_id integer NOT NULL,
    leccion_id integer NOT NULL,
    orden integer NOT NULL,
    regla_id integer,
    estado character varying(12) DEFAULT 'bloqueada'::character varying NOT NULL,
    origen character varying(12) DEFAULT 'modulo'::character varying NOT NULL,
    rondas integer DEFAULT 0 NOT NULL,
    aciertos integer DEFAULT 0 NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ruta_lecciones_estado_check CHECK (((estado)::text = ANY ((ARRAY['bloqueada'::character varying, 'disponible'::character varying, 'superada'::character varying])::text[]))),
    CONSTRAINT ruta_lecciones_origen_check CHECK (((origen)::text = ANY ((ARRAY['refuerzo'::character varying, 'modulo'::character varying, 'diagnostico'::character varying, 'repaso'::character varying])::text[])))
);


--
-- Name: ruta_lecciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ruta_lecciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ruta_lecciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ruta_lecciones_id_seq OWNED BY public.ruta_lecciones.id;


--
-- Name: rutas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rutas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    evaluacion_id integer NOT NULL,
    clave uuid NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: rutas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rutas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rutas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rutas_id_seq OWNED BY public.rutas.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    alias character varying(50) NOT NULL,
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    clave uuid
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: verosimilitudes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verosimilitudes (
    rama_id integer NOT NULL,
    hipotesis_id integer NOT NULL,
    probabilidad numeric(5,4) NOT NULL,
    CONSTRAINT verosimilitudes_probabilidad_check CHECK (((probabilidad > (0)::numeric) AND (probabilidad <= (1)::numeric)))
);


--
-- Name: diagnosticos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosticos ALTER COLUMN id SET DEFAULT nextval('public.diagnosticos_id_seq'::regclass);


--
-- Name: evaluaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones ALTER COLUMN id SET DEFAULT nextval('public.evaluaciones_id_seq'::regclass);


--
-- Name: hipotesis id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hipotesis ALTER COLUMN id SET DEFAULT nextval('public.hipotesis_id_seq'::regclass);


--
-- Name: inferencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inferencias ALTER COLUMN id SET DEFAULT nextval('public.inferencias_id_seq'::regclass);


--
-- Name: intentos_ejercicio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentos_ejercicio ALTER COLUMN id SET DEFAULT nextval('public.intentos_ejercicio_id_seq'::regclass);


--
-- Name: lecciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecciones ALTER COLUMN id SET DEFAULT nextval('public.lecciones_id_seq'::regclass);


--
-- Name: modulos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulos ALTER COLUMN id SET DEFAULT nextval('public.modulos_id_seq'::regclass);


--
-- Name: nodos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodos ALTER COLUMN id SET DEFAULT nextval('public.nodos_id_seq'::regclass);


--
-- Name: progreso id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso ALTER COLUMN id SET DEFAULT nextval('public.progreso_id_seq'::regclass);


--
-- Name: ramas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ramas ALTER COLUMN id SET DEFAULT nextval('public.ramas_id_seq'::regclass);


--
-- Name: reglas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas ALTER COLUMN id SET DEFAULT nextval('public.reglas_id_seq'::regclass);


--
-- Name: respuestas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas ALTER COLUMN id SET DEFAULT nextval('public.respuestas_id_seq'::regclass);


--
-- Name: ruta_lecciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruta_lecciones ALTER COLUMN id SET DEFAULT nextval('public.ruta_lecciones_id_seq'::regclass);


--
-- Name: rutas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutas ALTER COLUMN id SET DEFAULT nextval('public.rutas_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: diagnosticos diagnosticos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones evaluaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_pkey PRIMARY KEY (id);


--
-- Name: hipotesis hipotesis_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hipotesis
    ADD CONSTRAINT hipotesis_codigo_key UNIQUE (codigo);


--
-- Name: hipotesis hipotesis_nivel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hipotesis
    ADD CONSTRAINT hipotesis_nivel_key UNIQUE (nivel);


--
-- Name: hipotesis hipotesis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hipotesis
    ADD CONSTRAINT hipotesis_pkey PRIMARY KEY (id);


--
-- Name: inferencias inferencias_evaluacion_id_paso_hipotesis_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inferencias
    ADD CONSTRAINT inferencias_evaluacion_id_paso_hipotesis_id_key UNIQUE (evaluacion_id, paso, hipotesis_id);


--
-- Name: inferencias inferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inferencias
    ADD CONSTRAINT inferencias_pkey PRIMARY KEY (id);


--
-- Name: intentos_ejercicio intentos_ejercicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentos_ejercicio
    ADD CONSTRAINT intentos_ejercicio_pkey PRIMARY KEY (id);


--
-- Name: lecciones lecciones_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_codigo_key UNIQUE (codigo);


--
-- Name: lecciones lecciones_modulo_id_orden_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_modulo_id_orden_key UNIQUE (modulo_id, orden);


--
-- Name: lecciones lecciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_pkey PRIMARY KEY (id);


--
-- Name: lecciones_reglas lecciones_reglas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecciones_reglas
    ADD CONSTRAINT lecciones_reglas_pkey PRIMARY KEY (leccion_id, regla_id);


--
-- Name: modulos modulos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulos
    ADD CONSTRAINT modulos_codigo_key UNIQUE (codigo);


--
-- Name: modulos modulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulos
    ADD CONSTRAINT modulos_pkey PRIMARY KEY (id);


--
-- Name: nodos nodos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodos
    ADD CONSTRAINT nodos_codigo_key UNIQUE (codigo);


--
-- Name: nodos nodos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodos
    ADD CONSTRAINT nodos_pkey PRIMARY KEY (id);


--
-- Name: progreso progreso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso
    ADD CONSTRAINT progreso_pkey PRIMARY KEY (id);


--
-- Name: progreso progreso_usuario_id_modulo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso
    ADD CONSTRAINT progreso_usuario_id_modulo_id_key UNIQUE (usuario_id, modulo_id);


--
-- Name: ramas ramas_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ramas
    ADD CONSTRAINT ramas_codigo_key UNIQUE (codigo);


--
-- Name: ramas ramas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ramas
    ADD CONSTRAINT ramas_pkey PRIMARY KEY (id);


--
-- Name: reglas reglas_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas
    ADD CONSTRAINT reglas_codigo_key UNIQUE (codigo);


--
-- Name: reglas reglas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas
    ADD CONSTRAINT reglas_pkey PRIMARY KEY (id);


--
-- Name: reglas reglas_rama_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas
    ADD CONSTRAINT reglas_rama_id_key UNIQUE (rama_id);


--
-- Name: respuestas respuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_pkey PRIMARY KEY (id);


--
-- Name: ruta_lecciones ruta_lecciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruta_lecciones
    ADD CONSTRAINT ruta_lecciones_pkey PRIMARY KEY (id);


--
-- Name: ruta_lecciones ruta_lecciones_ruta_id_leccion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruta_lecciones
    ADD CONSTRAINT ruta_lecciones_ruta_id_leccion_id_key UNIQUE (ruta_id, leccion_id);


--
-- Name: ruta_lecciones ruta_lecciones_ruta_id_orden_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruta_lecciones
    ADD CONSTRAINT ruta_lecciones_ruta_id_orden_key UNIQUE (ruta_id, orden);


--
-- Name: rutas rutas_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutas
    ADD CONSTRAINT rutas_clave_key UNIQUE (clave);


--
-- Name: rutas rutas_evaluacion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutas
    ADD CONSTRAINT rutas_evaluacion_id_key UNIQUE (evaluacion_id);


--
-- Name: rutas rutas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutas
    ADD CONSTRAINT rutas_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_clave_key UNIQUE (clave);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: verosimilitudes verosimilitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verosimilitudes
    ADD CONSTRAINT verosimilitudes_pkey PRIMARY KEY (rama_id, hipotesis_id);


--
-- Name: idx_diagnosticos_evaluacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diagnosticos_evaluacion ON public.diagnosticos USING btree (evaluacion_id);


--
-- Name: idx_evaluaciones_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluaciones_usuario ON public.evaluaciones USING btree (usuario_id);


--
-- Name: idx_evaluaciones_usuario_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluaciones_usuario_fecha ON public.evaluaciones USING btree (usuario_id, fecha_inicio DESC);


--
-- Name: idx_inferencias_evaluacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inferencias_evaluacion ON public.inferencias USING btree (evaluacion_id);


--
-- Name: idx_intentos_ruta_leccion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intentos_ruta_leccion ON public.intentos_ejercicio USING btree (ruta_leccion_id, id DESC);


--
-- Name: idx_lecciones_reglas_regla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lecciones_reglas_regla ON public.lecciones_reglas USING btree (regla_id);


--
-- Name: idx_nodos_modulo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nodos_modulo ON public.nodos USING btree (modulo_id);


--
-- Name: idx_progreso_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progreso_usuario ON public.progreso USING btree (usuario_id);


--
-- Name: idx_ramas_nodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ramas_nodo ON public.ramas USING btree (nodo_id);


--
-- Name: idx_reglas_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_tipo ON public.reglas USING btree (tipo);


--
-- Name: idx_respuestas_evaluacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_respuestas_evaluacion ON public.respuestas USING btree (evaluacion_id);


--
-- Name: idx_ruta_lecciones_ruta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ruta_lecciones_ruta ON public.ruta_lecciones USING btree (ruta_id);


--
-- Name: idx_verosimilitudes_hipotesis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verosimilitudes_hipotesis ON public.verosimilitudes USING btree (hipotesis_id);


--
-- Name: diagnosticos diagnosticos_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones(id);


--
-- Name: diagnosticos diagnosticos_modulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id);


--
-- Name: diagnosticos diagnosticos_regla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnosticos
    ADD CONSTRAINT diagnosticos_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.reglas(id);


--
-- Name: evaluaciones evaluaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: inferencias inferencias_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inferencias
    ADD CONSTRAINT inferencias_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones(id);


--
-- Name: inferencias inferencias_hipotesis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inferencias
    ADD CONSTRAINT inferencias_hipotesis_id_fkey FOREIGN KEY (hipotesis_id) REFERENCES public.hipotesis(id);


--
-- Name: inferencias inferencias_rama_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inferencias
    ADD CONSTRAINT inferencias_rama_id_fkey FOREIGN KEY (rama_id) REFERENCES public.ramas(id);


--
-- Name: intentos_ejercicio intentos_ejercicio_ruta_leccion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentos_ejercicio
    ADD CONSTRAINT intentos_ejercicio_ruta_leccion_id_fkey FOREIGN KEY (ruta_leccion_id) REFERENCES public.ruta_lecciones(id);


--
-- Name: lecciones lecciones_modulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecciones
    ADD CONSTRAINT lecciones_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id);


--
-- Name: lecciones_reglas lecciones_reglas_leccion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecciones_reglas
    ADD CONSTRAINT lecciones_reglas_leccion_id_fkey FOREIGN KEY (leccion_id) REFERENCES public.lecciones(id);


--
-- Name: lecciones_reglas lecciones_reglas_regla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecciones_reglas
    ADD CONSTRAINT lecciones_reglas_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.reglas(id);


--
-- Name: nodos nodos_modulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodos
    ADD CONSTRAINT nodos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id);


--
-- Name: progreso progreso_modulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso
    ADD CONSTRAINT progreso_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id);


--
-- Name: progreso progreso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso
    ADD CONSTRAINT progreso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: ramas ramas_nodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ramas
    ADD CONSTRAINT ramas_nodo_id_fkey FOREIGN KEY (nodo_id) REFERENCES public.nodos(id);


--
-- Name: ramas ramas_siguiente_nodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ramas
    ADD CONSTRAINT ramas_siguiente_nodo_id_fkey FOREIGN KEY (siguiente_nodo_id) REFERENCES public.nodos(id);


--
-- Name: reglas reglas_rama_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas
    ADD CONSTRAINT reglas_rama_id_fkey FOREIGN KEY (rama_id) REFERENCES public.ramas(id);


--
-- Name: respuestas respuestas_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones(id);


--
-- Name: respuestas respuestas_nodo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_nodo_id_fkey FOREIGN KEY (nodo_id) REFERENCES public.nodos(id);


--
-- Name: respuestas respuestas_rama_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas
    ADD CONSTRAINT respuestas_rama_id_fkey FOREIGN KEY (rama_id) REFERENCES public.ramas(id);


--
-- Name: ruta_lecciones ruta_lecciones_leccion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruta_lecciones
    ADD CONSTRAINT ruta_lecciones_leccion_id_fkey FOREIGN KEY (leccion_id) REFERENCES public.lecciones(id);


--
-- Name: ruta_lecciones ruta_lecciones_regla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruta_lecciones
    ADD CONSTRAINT ruta_lecciones_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.reglas(id);


--
-- Name: ruta_lecciones ruta_lecciones_ruta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ruta_lecciones
    ADD CONSTRAINT ruta_lecciones_ruta_id_fkey FOREIGN KEY (ruta_id) REFERENCES public.rutas(id);


--
-- Name: rutas rutas_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutas
    ADD CONSTRAINT rutas_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones(id);


--
-- Name: rutas rutas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rutas
    ADD CONSTRAINT rutas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: verosimilitudes verosimilitudes_hipotesis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verosimilitudes
    ADD CONSTRAINT verosimilitudes_hipotesis_id_fkey FOREIGN KEY (hipotesis_id) REFERENCES public.hipotesis(id);


--
-- Name: verosimilitudes verosimilitudes_rama_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verosimilitudes
    ADD CONSTRAINT verosimilitudes_rama_id_fkey FOREIGN KEY (rama_id) REFERENCES public.ramas(id);


--
-- PostgreSQL database dump complete
--

