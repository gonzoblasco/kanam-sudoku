# RESEARCH - Catalogo de tecnicas de sudoku 9x9

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

Investigacion de Kanam MIND para Kanam SUDOKU. Insumo del motor de hints y de
la escalera de dificultad (SPEC v1, FR-8, FR-9, U2, U3).

- Fecha: 2026-09-26.
- Alcance: sudoku clasico 9x9, sin variantes.
- Objetivo: catalogo tecnico usable para implementar un motor de deteccion y
  explicacion, ordenado de mas simple a mas dificil.

## 0. Como leer este documento

Cada tecnica trae seis campos: **nombre** (es/en), **cuando aplica** (patron a
detectar), **que deduce**, **explicacion en lenguaje llano** (el texto que lee el
jugador), **datos de deteccion** (estructuras y minimo de candidatos) y
**posicion en la escalera**.

Todos los datos de dificultad por tecnica salen de la escala ER del *Sudoku
Explainer* / *Sukaku Explainer* (ver fuentes en la seccion 9), que es el esquema
numerico mas citado por la comunidad. Cuando algo no lo pude verificar, lo marco
con **NO VERIFICADO** o **INFERENCIA** y lo repito en la seccion 8.

Convenciones:
- Fila, columna y caja se llaman en conjunto **unidad** (house en la jerga
  inglesa). Hay 27 unidades.
- **Vecinas** de una casilla = las 20 casillas que comparten fila, columna o
  caja con ella (peers).
- **Candidato**: numero que todavia puede ir en una casilla sin romper reglas.
- **Eliminar** = sacar un candidato. **Colocar** = confirmar el numero final.
  Esta distincion es clave para los hints: casi todas las tecnicas avanzadas
  solo eliminan, y el hint debe decir "por que este numero NO puede ir aca", no
  "esto va aca".

## 1. Vocabulario minimo para el motor

- **Unidad**: 9 filas + 9 columnas + 9 cajas = 27.
- **Subset (conjunto)**: N casillas de una unidad con N digitos.
  - **Naked subset**: N casillas cuyos candidatos en conjunto son exactamente N
    digitos.
  - **Hidden subset**: N digitos que solo tienen candidato en N casillas de la
    unidad.
  - Un naked subset y un hidden subset del mismo tamaño son complementarios:
    encontrar uno implica el otro.
- **Strong link (link fuerte / par conjugado)**: para un digito en una unidad,
  solo hay dos casillas posibles. Entonces una es verdadera o la otra.
- **Weak link (link debil)**: para un digito, dos casillas en la misma unidad
  (o dos digitos en la misma casilla) que no pueden ser verdaderos juntos.
- **Fish**: patron de un solo digito que compara N filas contra N columnas.
- **ER / rating**: numero de la escala del Sudoku Explainer. Mas alto = mas
  dificil.

Referencias de vocabulario: Sudopedia "Solving Technique", "House", "Subset",
"Fish" (URLs en la seccion 9).

## 2. Nivel 0 - Singles (Full House, Hidden Single, Naked Single)

Estas tres resuelven la mayoria de los sudokus publicados en diarios. Sudopedia
afirma que "most of the Sudokus published in newspapers and magazines can be
solved by hidden singles only".

### 2.1 Full House (Casa completa / Ultimo numero)

- **Nombre**: Full House / Last Digit. En español: "casa completa" o "ultimo
  numero del grupo".
- **Cuando aplica**: una fila, columna o caja tiene una sola casilla vacia (o,
  en la version "Last Digit", queda un solo ejemplar de un digito sin colocar en
  todo el tablero).
- **Que deduce**: coloca el numero que falta. No elimina nada.
- **Explicacion llana**: "Esta fila ya tiene ocho casillas llenas. Falta un solo
  numero: el 6. La casilla vacia es la ultima de la fila, asi que ahi va el 6."
- **Datos de deteccion**: no requiere grilla de candidatos; alcanza con contar
  digitos por unidad. Minimo: 1 casilla vacia en la unidad.
- **Posicion**: aparece sobre todo al final de la partida, cuando el tablero esta
  casi lleno. Es la tecnica mas facil posible (ER 1.0).
- **Fuente**: Sudopedia "Full House"; HoDoKu "Singles" (via Wayback).

### 2.2 Hidden Single (Single oculto)

- **Nombre**: Hidden Single; alias "Pinned Digit", "Single Position". En
  español: "single oculto" o "numero fijado".
- **Cuando aplica**: en una unidad, un digito tiene un solo candidato posible.
  La casilla puede tener otros candidatos; el digito esta "oculto" entre ellos.
- **Que deduce**: coloca ese digito en esa casilla.
- **Explicacion llana**: "Mira donde podria ir el 4 en esta caja. Aunque varias
  casillas tienen otros numeros anotados, el 4 solo cabe en una. Entonces esa
  casilla es el 4."
- **Datos de deteccion**: mapa digito -> casillas candidatas por unidad; o grilla
  de candidatos. Minimo: un digito con 1 sola casilla candidata en una unidad.
- **Posicion**: aparece desde el primer movimiento y domina la parte temprana y
  media de la mayoria de los puzzles. En un tablero sin notas se busca por
  "cross-hatching" (cruzar filas y columnas). ER 1.2 en caja, 1.5 en fila/columna.
- **Nota de UX**: HoDoKu advierte algo importante para el diseno del juego: con
  lapiz y papel el hidden single es facil de ver, pero en un programa que dibuja
  todos los candidatos puede ser *mas* dificil de ver que el naked single. El
  hint deberia resaltar la unidad y el digito, no solo la casilla.
- **Fuente**: Sudopedia "Hidden Single"; HoDoKu "Singles".

### 2.3 Naked Single (Single desnudo)

- **Nombre**: Naked Single; alias "Forced Digit", "Sole Candidate". En español:
  "single desnudo" o "candidato unico".
- **Cuando aplica**: una casilla tiene un solo candidato posible.
- **Que deduce**: coloca ese candidato.
- **Explicacion llana**: "En esta casilla ya no cabe ningun otro numero: el 1, 2,
  3, 4, 5, 7, 8 y 9 ya estan en su fila, su columna o su caja. Solo queda el 6."
- **Datos de deteccion**: grilla de candidatos; contar candidatos por casilla.
  Minimo: 1 casilla con 1 candidato.
- **Posicion**: al principio casi no hay; aumenta hacia el final de la partida a
  medida que se llenan las vecinas. ER 2.3 (resulta curioso que el ER lo ponga
  mas dificil que el hidden single; es un reflejo de que el naked single es
  trivial de computar pero pesado de ver a mano).
- **Fuente**: Sudopedia "Naked Single"; HoDoKu "Singles".

**Corte practico**: un puzzle resoluble solo con singles (full house + hidden +
naked) es lo que casi cualquier jugador llama "facil". Es el primer corte de la
escalera (seccion 4).

## 3. Nivel 1 a 7 - El resto del catalogo

### 3.1 Locked Candidates - Pointing (Candidatos bloqueados, tipo 1)

- **Nombre**: Locked Candidates Type 1 / Pointing (Pair, Triple); alias
  "Intersection Removal", "Line-Box Interaction". En español: "candidatos
  bloqueados" / "apuntado".
- **Cuando aplica**: en una *caja*, todos los candidatos de un digito estan en
  una sola fila o columna (la interseccion caja-linea).
- **Que deduce**: elimina ese digito del resto de esa fila/columna, fuera de la
  caja.
- **Explicacion llana**: "En esta caja el 5 solo puede ir en la fila 3. Como la
  caja necesita un 5, ese 5 va a caer en la fila 3. Entonces, en el resto de la
  fila 3 no puede haber ningun 5."
- **Datos de deteccion**: por caja y por digito, la lista de casillas candidatas.
  Minimo: 2 o 3 candidatos del digito, todos en la misma linea dentro de la caja
  (por eso "pair" o "triple").
- **Posicion**: temprana-media. Suele ser la primera tecnica "de verdad" que hay
  que usar cuando los singles se agotan. ER 1.7 si resuelve de una, 2.6 normal.
- **Fuente**: Sudopedia "Locked Candidates"; HoDoKu "Intersections".

### 3.2 Locked Candidates - Claiming / Box-Line Reduction (tipo 2)

- **Nombre**: Locked Candidates Type 2 / Claiming / Box-Line Reduction. En
  español: "reduccion caja-linea" / "reclamo".
- **Cuando aplica**: en una *fila o columna*, todos los candidatos de un digito
  estan dentro de una sola caja.
- **Que deduce**: elimina ese digito del resto de esa caja.
- **Explicacion llana**: "En esta fila el 7 solo puede ir dentro de esta caja.
  Entonces, en el resto de la caja no puede haber ningun 7."
- **Datos de deteccion**: por linea y por digito, la lista de casillas
  candidatas. Minimo: 2 o 3 candidatos, todos dentro de una misma caja.
- **Posicion**: igual que Pointing, temprana-media. ER 1.9 / 2.8.
- **Fuente**: Sudopedia "Locked Candidates"; HoDoKu "Intersections".

### 3.3 Naked Pair (Par desnudo)

- **Nombre**: Naked Pair; variante "Locked Pair" cuando las dos casillas estan
  en una interseccion. En español: "par desnudo".
- **Cuando aplica**: dos casillas de la misma unidad con exactamente los mismos
  dos candidatos.
- **Que deduce**: elimina esos dos digitos del resto de la unidad.
- **Explicacion llana**: "Estas dos casillas solo admiten 5 y 6. Entre las dos se
  reparten esos dos numeros. Entonces ningun otro lugar de esta columna puede ser
  5 ni 6."
- **Datos de deteccion**: grilla de candidatos; buscar pares de casillas
  bivaluadas con el mismo conjunto. Minimo: 2 casillas con exactamente 2
  candidatos identicos.
- **Posicion**: media. Aparece cuando el tablero ya tiene bastantes notas. ER 3.0.
- **Fuente**: Sudopedia "Naked Pair", "Naked Subset".

### 3.4 Hidden Pair (Par oculto)

- **Nombre**: Hidden Pair. En español: "par oculto".
- **Cuando aplica**: dos digitos cuyos candidatos en una unidad estan limitados
  a las mismas dos casillas (las casillas pueden tener ademas otros candidatos).
- **Que deduce**: elimina todos los demas candidatos de esas dos casillas.
- **Explicacion llana**: "En esta fila los numeros 1 y 7 solo caben en estas dos
  casillas. Aunque tengan otras anotaciones, esas otras no pueden ir aca: estas
  dos casillas son para el 1 y el 7."
- **Datos de deteccion**: mapa digito -> casillas por unidad. Minimo: 2 digitos
  con exactamente 2 casillas candidatas cada uno, y que sean las mismas dos.
- **Posicion**: media. ER 3.4.
- **Fuente**: Sudopedia "Hidden Pair", "Hidden Subset".

### 3.5 Naked Triple (Triple desnudo)

- **Nombre**: Naked Triple; variante "Locked Triple". En español: "triple
  desnudo".
- **Cuando aplica**: tres casillas de una unidad cuyos candidatos, en conjunto,
  pertenecen a exactamente tres digitos. No hace falta que cada casilla tenga los
  tres: pueden ser pares y singles mezclados.
- **Que deduce**: elimina esos tres digitos del resto de la unidad.
- **Explicacion llana**: "Estas tres casillas, juntas, solo pueden recibir 6, 7 u
  8. Entre las tres se reparten esos tres numeros. Entonces en el resto de la
  columna no puede haber 6, 7 ni 8."
- **Datos de deteccion**: combinar ternas de casillas no resueltas por unidad y
  verificar que la union de candidatos tenga tamaño 3. Minimo: union de tamaño 3.
- **Posicion**: media. ER 3.6. Es notablemente mas dificil de ver que el par
  porque no todas las casillas muestran los tres digitos.
- **Fuente**: Sudopedia "Naked Triple".

### 3.6 Hidden Triple (Triple oculto)

- **Nombre**: Hidden Triple. En español: "triple oculto".
- **Cuando aplica**: tres digitos limitados a las mismas tres casillas de una
  unidad.
- **Que deduce**: elimina los demas candidatos de esas tres casillas.
- **Explicacion llana**: "En esta fila los numeros 2, 5 y 7 solo caben en estas
  tres casillas. Cualquier otra anotacion en ellas no puede ir aca."
- **Datos de deteccion**: mapa digito -> casillas. Minimo: 3 digitos con sus
  candidatos contenidos en las mismas 3 casillas.
- **Posicion**: media. ER 4.0.
- **Fuente**: Sudopedia "Hidden Triple", "Hidden Subset".

### 3.7 Naked Quad (Cuadruple desnudo)

- **Nombre**: Naked Quad. En español: "cuadruple desnudo".
- **Cuando aplica**: cuatro casillas de una unidad con candidatos (en conjunto)
  de exactamente cuatro digitos.
- **Que deduce**: elimina esos cuatro digitos del resto de la unidad.
- **Explicacion llana**: "Estas cuatro casillas, juntas, solo pueden recibir 1, 2,
  3 y 4. Entonces en el resto de la caja no puede ir ninguno de esos cuatro."
- **Datos de deteccion**: combinaciones de 4 casillas por unidad. Minimo: union de
  tamaño 4. No cabe en una interseccion (solo tiene 3 casillas).
- **Posicion**: media-tardia. ER 5.0.
- **Fuente**: Sudopedia "Naked Quad", "Naked Subset".

### 3.8 Hidden Quad (Cuadruple oculto)

- **Nombre**: Hidden Quad. En español: "cuadruple oculto".
- **Cuando aplica**: cuatro digitos limitados a las mismas cuatro casillas de una
  unidad.
- **Que deduce**: elimina los demas candidatos de esas cuatro casillas.
- **Explicacion llana**: "En esta caja los numeros 1, 3, 6 y 9 solo caben en
  estas cuatro casillas."
- **Datos de deteccion**: mapa digito -> casillas. Minimo: 4 digitos contenidos en
  las mismas 4 casillas.
- **Posicion**: tarden. ER 5.4.
- **Fuente**: Sudopedia "Hidden Quad".
- **Nota util**: en un sudoku de tamaño estandar no hace falta buscar subsets
  mayores a 4, porque el complementario siempre va a tener tamaño 4 o menos
  (Sudopedia "Hidden Subset"). Esto acota el costo del motor.

### 3.9 X-Wing

- **Nombre**: X-Wing. En español se usa el nombre en ingles o "ala X".
- **Cuando aplica**: un digito aparece exactamente dos veces en cada una de dos
  filas, y las cuatro casillas caen en las mismas dos columnas (o el espejo:
  dos columnas, dos filas).
- **Que deduce**: elimina ese digito del resto de esas dos columnas (fuera de las
  filas que lo definen).
- **Explicacion llana**: "El 4 aparece solo dos veces en la fila 1 y solo dos
  veces en la fila 4, y siempre en las mismas dos columnas. Entre esas cuatro
  casillas se acomodan los dos 4. Entonces, en esas dos columnas, fuera de esas
  filas, no puede haber ningun 4."
- **Datos de deteccion**: por digito, casillas candidatas por linea; detectar
  lineas "bilocales" (exactamente 2 candidatos) y cruzar. Minimo: 2 filas o
  columnas con exactamente 2 candidatos alineados.
- **Posicion**: media-tardia; es la primera tecnica de la familia fish. ER 3.2.
- **Fuente**: Sudopedia "X-Wing", "Fish".

### 3.10 Swordfish

- **Nombre**: Swordfish. En español, nombre en ingles ("pez espada").
- **Cuando aplica**: un digito aparece en 2 o 3 casillas de cada una de tres
  filas, y todas caen dentro de las mismas tres columnas (o el espejo).
- **Que deduce**: elimina ese digito del resto de esas tres columnas (fuera de las
  tres filas definidoras).
- **Explicacion llana**: "El 9 solo puede ir en tres columnas si miramos tres
  filas a la vez. Cada una de esas filas necesita un 9, y los tres 9 tienen que
  caer en esas tres columnas. Entonces, en esas columnas, fuera de esas filas, no
  puede haber 9."
- **Datos de deteccion**: por digito, combinaciones de 3 lineas y union de sus
  lineas cruzadas. Minimo: 3 lineas definidoras cubriendo exactamente 3 lineas
  cruzadas. Sudopedia advierte que es dificil de ver en la grilla de notas.
- **Posicion**: tarden (dificil). ER 3.8.
- **Fuente**: Sudopedia "Swordfish".

### 3.11 Jellyfish

- **Nombre**: Jellyfish. En español, nombre en ingles ("medusa").
- **Cuando aplica**: un digito aparece en 2 a 4 casillas de cada una de cuatro
  filas, y todas caen dentro de las mismas cuatro columnas (o el espejo).
- **Que deduce**: elimina ese digito del resto de esas cuatro columnas (fuera de
  las cuatro filas definidoras).
- **Explicacion llana**: "Mirando cuatro filas a la vez, el 8 solo puede caer en
  cuatro columnas. Como las cuatro filas necesitan su 8, esas cuatro columnas
  quedan ocupadas. En las demas casillas de esas columnas no puede haber 8."
- **Datos de deteccion**: por digito, combinaciones de 4 lineas. Minimo: 4 lineas
  definidoras cubriendo exactamente 4 lineas cruzadas. Sudopedia: "mucho mas
  dificil de encontrar que un X-Wing o un Swordfish".
- **Posicion**: experto. ER 5.2.
- **Fuente**: Sudopedia "Jellyfish", "Fish".

### 3.12 XY-Wing

- **Nombre**: XY-Wing. En español se usa "ala XY" o el nombre ingles.
- **Cuando aplica**: tres casillas bivaluadas: un pivote con candidatos XY y dos
  puntas (pincers) XZ e YZ, donde las dos puntas ven al pivote.
- **Que deduce**: cualquier casilla que vea a las *dos* puntas no puede contener
  Z.
- **Explicacion llana**: "Mira estas tres casillas. La del medio tiene 7 y 9; una
  punta tiene 7 y 3; la otra tiene 9 y 3. Si el medio es 7, la primera punta es 3;
  si el medio es 9, la segunda punta es 3. En cualquier caso, una de las dos
  puntas es 3. Entonces la casilla que ve a las dos puntas no puede ser 3."
- **Datos de deteccion**: lista de casillas bivaluadas; para cada pivote,
  bivaluadas vecinas que compartan exactamente un candidato con el pivote y con
  la punta opuesta. Minimo: 3 casillas con exactamente 2 candidatos, con la
  estructura XY / XZ / YZ. Ojo: la condicion de "ver" es fila/columna/caja.
- **Posicion**: tarden. ER 4.2.
- **Fuente**: Sudopedia "XY-Wing".

### 3.13 XYZ-Wing

- **Nombre**: XYZ-Wing.
- **Cuando aplica**: como el XY-Wing, pero el pivote tiene tres candidatos XYZ.
- **Que deduce**: elimina Z de las casillas que ven al pivote y a la punta
  correcta (hasta 2 eliminaciones).
- **Explicacion llana**: "Aca la casilla del medio tiene 7, 9 y 3. Si fuera 7, una
  punta es 3; si fuera 9, la otra punta es 3; y si fuera 3, ella misma es 3. De
  cualquier forma, hay un 3 al lado. Entonces las casillas que ven a la del medio
  y a las puntas no pueden ser 3."
- **Datos de deteccion**: pivote de 3 candidatos + puntas bivaluadas que
  compartan subconjuntos. Minimo: 1 casilla con 3 candidatos + 2 bivaluadas
  vecinas.
- **Posicion**: tarden. ER 4.4.
- **Fuente**: Sudopedia "XYZ-Wing".

### 3.14 W-Wing

- **Nombre**: W-Wing.
- **Cuando aplica**: dos casillas bivaluadas idénticas (W,X) conectadas por un
  strong link en el digito X (un par conjugado de X que une dos casillas vecinas
  de cada extremo).
- **Que deduce**: elimina W de cualquier casilla que vea a las dos bivaluadas.
- **Explicacion llana**: "Estas dos casillas tienen los mismos dos candidatos, 2 y
  7. Estan conectadas porque el 7 en esta zona solo puede ir en dos lugares.
  Pase lo que pase, una de las dos casillas va a ser 7 y la otra 2, asi que una
  de ellas siempre es 2. Por eso, la casilla que ve a ambas no puede ser 2."
- **Datos de deteccion**: bivaluadas + grafo de strong links por digito. Minimo:
  2 bivaluadas identicas + 1 strong link sobre un digito compartido.
- **Posicion**: experto. ER 5.5-5.6 (SE v1.17.8, WXYZ Wing).
- **Fuente**: Sudopedia "W-Wing".
- **NO VERIFICADO**: el ER exacto del W-Wing aislado no aparece en las tablas de
  SE que abri; SE lista WXYZ-Wing en 5.5-5.6. El valor del W-Wing simple queda en
  duda.

### 3.15 Skyscraper (rascacielos)

- **Nombre**: Skyscraper. Es un patron de la familia Turbot Fish.
- **Cuando aplica**: dos strong links (pares conjugados) paralelos para un mismo
  digito, en dos filas (o columnas), con un extremo de cada uno alineado en la
  misma columna (la "base"), y los otros dos extremos sobresaliendo.
- **Que deduce**: elimina el digito de las casillas que ven a los dos extremos que
  sobresalen.
- **Explicacion llana**: "El 4 solo tiene dos lugares en la fila 4 y dos en la
  fila 7, y las parejas estan conectadas por una columna. Como la columna solo
  admite un 4, al menos uno de los extremos que sobresalen va a ser 4. La casilla
  que ve a esos dos extremos no puede ser 4."
- **Datos de deteccion**: grafo de strong links por digito; buscar dos strong
  links paralelos con un extremo en comun de linea. Minimo: 2 pares conjugados del
  mismo digito en lineas paralelas.
- **Posicion**: tarden. ER 4.0-4.3.
- **Fuente**: Sudopedia "Skyscraper".

### 3.16 2-String Kite (cometa de dos cuerdas)

- **Nombre**: 2-String Kite. Familia Turbot Fish.
- **Cuando aplica**: un par conjugado en una fila y otro par conjugado en una
  columna, para el mismo digito, cuyos extremos "se tocan" dentro de una misma
  caja.
- **Que deduce**: elimina el digito de la casilla que ve a los dos extremos
  externos.
- **Explicacion llana**: "Estas dos casillas de la izquierda son las unicas donde
  cabe el 5 en su fila; estas dos de arriba son las unicas donde cabe el 5 en su
  columna, y se tocan en esta caja. Eso obliga a que una de las esquinas libres
  sea 5, asi que la casilla que ve a las dos no puede ser 5."
- **Datos de deteccion**: strong links en una linea horizontal y una vertical,
  cruzados por caja. Minimo: 2 pares conjugados (uno en fila, uno en columna).
- **Posicion**: tarden. ER 4.0-4.3.
- **Fuente**: Sudopedia "2-String Kite".

### 3.17 Empty Rectangle (rectangulo vacio)

- **Nombre**: Empty Rectangle; alias "hinge". En español: "rectangulo vacio".
- **Cuando aplica**: un par conjugado de un digito en una fila (o columna) + una
  caja donde todos los candidatos de ese digito quedan contenidos en una sola
  fila y una sola columna de la caja (formando una L).
- **Que deduce**: elimina el digito de la casilla que ve a un extremo de la L y a
  un extremo del par conjugado.
- **Explicacion llana**: "En esta caja el 9 solo aparece en forma de L: una fila y
  una columna. Combinado con la pareja de 9 de la fila de arriba, siempre queda
  un 9 en la esquina. Por eso esta casilla, que ve a las dos esquinas posibles, no
  puede ser 9."
- **Datos de deteccion**: por caja y digito, verificar candidatos confinados a una
  fila mas una columna; combinar con strong links. Minimo: 1 pares conjugados + 1
  caja en L.
- **Posicion**: experto. ER 4.0-4.3 (junto a Skyscraper/Kite).
- **Fuente**: Sudopedia "Empty Rectangle".

### 3.18 Simple Colors (coloracion simple: Color Trap / Color Wrap)

- **Nombre**: Simple Colors; subtipos Color Trap y Color Wrap. En español:
  "coloreo simple".
- **Cuando aplica**: se marcan los candidatos de un digito con dos colores
  alternados siguiendo los strong links (pares conjugados). O todos los de un
  color son el digito, o todos los del otro.
- **Que deduce**:
  - Color Trap: una casilla que "ve" a las dos casillas de distinto color no
    puede ser ese digito.
  - Color Wrap: si un color se contradice (dos casillas del mismo color en la
    misma unidad), ese color entero se descarta.
- **Explicacion llana**: "Pinte todos los lugares posibles del 3 con dos colores:
  o todos los azules son 3, o todos los verdes. Esta casilla ve un azul y un
  verde a la vez, asi que no puede ser 3."
- **Datos de deteccion**: grafo de strong links por digito; recorrer componentes
  conexas y colorear por paridad; detectar vecindades de doble color o
  contradicciones. Minimo: al menos una cadena de strong links (2 o mas pares
  conjugados).
- **Posicion**: tarden. ER forma parte de "3 strong links techniques" 5.4-5.7 y
  de Unique/loops 4.5-5.3 segun Sukaku Explainer.
- **Fuente**: Sudopedia "Simple Colors", "Coloring".

### 3.19 X-Chain

- **Nombre**: X-Chain (cadena X). Tambien equivalente a X-Cycle cuando cierra.
- **Cuando aplica**: cadena de un solo digito con links que alternan strong y
  weak, empezando y terminando en strong.
- **Que deduce**: elimina el digito de toda casilla que vea a los dos extremos de
  la cadena.
- **Explicacion llana**: "Sigo una cadena: si aca no esta el 3, tiene que estar
  alla; si alla no esta, tiene que estar en la proxima... Al final, uno de los
  dos extremos de la cadena es 3. Entonces esta casilla, que ve a los dos
  extremos, no puede ser 3."
- **Datos de deteccion**: grafo de strong/weak links por digito; busqueda de
  caminos alternados. Sudopedia: la cadena util mas corta tiene al menos 4
  casillas (en sudoku clasico).
- **Posicion**: experto. ER 6.5-6.9.
- **Fuente**: Sudopedia "X-Chain".

### 3.20 XY-Chain / Remote Pair

- **Nombre**: XY-Chain; Remote Pair es su forma reducida a dos digitos.
- **Cuando aplica**: cadena de casillas bivaluadas donde cada eslabon comparte un
  candidato con el anterior.
- **Que deduce**: elimina un digito de las casillas que ven a los dos extremos.
- **Explicacion llana**: "Estas casillas forman una reaccion en cadena: cada una
  tiene dos numeros y comparte uno con la vecina. Si la primera no es 3, la
  segunda si, y asi hasta el final. Resulta que uno de los extremos siempre va a
  ser 3, asi que la casilla que ve a ambos no puede serlo."
- **Datos de deteccion**: grafo de bivaluadas; busqueda de caminos. Mas costoso
  que X-Chain.
- **Posicion**: experto. Remote Pair cae en el bloque de chains; SE lista XY-Chain
  dentro de chains (7.0-8.0 "bidirectional cycles" cubre parte de esto).
- **Fuente**: Sudopedia "XY-Chain", "Remote Pairs".

### 3.21 Unique Rectangle (rectangulo unico)

- **Nombre**: Unique Rectangle (Type 1 a 6). Es de la familia "uniqueness
  techniques", basadas en asumir solucion unica.
- **Cuando aplica**: cuatro casillas que forman un rectangulo (dos filas, dos
  columnas, dos cajas) y todas tienen candidatos para los mismos dos digitos.
  Ese patron "mortal" (deadly pattern) permitiria dos soluciones distintas.
- **Que deduce**: como el puzzle tiene solucion unica, hay que romper el patron.
  En la forma mas simple (Type 1), si tres casillas tienen solo {a,b} y la cuarta
  tiene {a,b,c}, entonces esa cuarta no puede ser ni a ni b: hay que poner c.
- **Explicacion llana**: "Estas cuatro casillas forman un rectangulo y todas
  admiten 1 y 2. Si las dos columnas se resolvieran una como 1/2 y la otra como
  2/1, el tablero tendria dos soluciones distintas. Como la solucion es unica, ese
  patron no puede completarse: la casilla que ademas admite el 3 tiene que ser 3."
- **Datos de deteccion**: por pares de lineas, buscar rectangulos; verificar
  candidatos. Minimo: 4 casillas con candidatos {a,b}; Type 1 requiere una con un
  candidato extra.
- **Posicion**: tarden-experto. ER 4.5-5.3 (Sukaku) / 4.5-5.0 (SE 1.2.1).
- **Fuente**: Sudopedia "Unique Rectangle", "Uniqueness Test".
- **Advertencia**: usa la suposicion de solucion unica. Sudopedia documenta en
  "Uniqueness Controversy" que esa suposicion "no es universalmente aceptada".
  Para un juego que garantiza solucion unica (NFR-3) la tecnica es aplicable,
  pero el hint tendria que explicar esa suposicion.

### 3.22 ALS-XZ y familia ALS (Almost Locked Set)

- **Nombre**: ALS-XZ rule; tambien ALS-XY-Wing, ALS-Chain, Death Blossom. En
  español: "conjuntos casi cerrados".
- **Cuando aplica**: dos conjuntos de casillas que casi forman un subset (N
  casillas con N+1 candidatos), con un digito comun restringido.
- **Que deduce**: elimina un digito comun de las casillas que los ven.
- **Explicacion llana**: **dificil de poner en lenguaje llano**. Lo mas honesto
  es: "Estas casillas casi se completan entre si. Si el numero compartido no
  puede estar en las dos, tiene que estar en una, y eso obliga a que este otro
  numero este aca." Es exactamente el tipo de tecnica donde el objetivo "sin
  jerga" del FR-9 se vuelve costoso.
- **Datos de deteccion**: enumerar subsets de casillas por unidad con exactamente
  N+1 candidatos, y buscar pares con digito comun restringido. Costo alto.
- **Posicion**: experto. ER 6.2 (Aligned Pair Exclusion, pariente cercano).
- **Fuente**: Sudopedia "Almost Locked Set", "ALS-XZ", "Aligned Pair Exclusion".
- **Recomendacion**: fuera de v1 (ver seccion 5).

### 3.23 Sue de Coq

- **Nombre**: Sue de Coq; alias "Two-Sector Disjoint Subsets".
- **Cuando aplica**: una linea y una caja que se cruzan: N casillas con N
  candidatos en la linea, N casillas con N candidatos en la caja, y los candidatos
  que estan en una pero no en la otra no se repiten.
- **Que deduce**: elimina candidatos de las casillas de la linea fuera del conjunto
  A y de las casillas de la caja fuera del conjunto B.
- **Explicacion llana**: practicamente imposible de explicar sin jerga; es una
  tecnica de libro.
- **Datos de deteccion**: analisis de intersecciones con conteo de candidatos.
  Costo alto.
- **Posicion**: experto. ER ~6.2-6.5 (SE lo trata en "5 strong links" /
  miscellaneous; el ER exacto variaba en la v1.17.8).
- **Fuente**: Sudopedia "Sue de Coq".
- **NO VERIFICADO**: el ER exacto de Sue de Coq en la tabla v1.17.8 que abri no
  es un valor unico; queda en duda.

### 3.24 BUG / BUG+1 (Bivalue Universal Grave)

- **Nombre**: Bivalue Universal Grave; BUG Lite; Reverse BUG.
- **Cuando aplica**: todos los candidatos del tablero aparecen exactamente dos
  veces por unidad, salvo una casilla que tiene un candidato extra.
- **Que deduce**: esa casilla es el digito extra.
- **Explicacion llana**: "Si dejamos todo como esta, el tablero permitiria dos
  formas de completarse. Como solo hay una solucion, esta casilla tiene que ser el
  numero de mas que le sobra."
- **Datos de deteccion**: contar ocurrencias de candidatos por unidad en todo el
  tablero.
- **Posicion**: experto. ER 5.6-6.0.
- **Fuente**: Sudopedia "Bivalue Universal Grave", "BUG Lite".
- **Nota**: otra tecnica basada en unicidad; mismo costo de explicacion que la UR.

### 3.25 Fuera de alcance v1 (resumen; detalle en seccion 5)

Fish con aleta (Finned/Sashimi/Franken/Mutant/Kraken), Multi-Colors y 3D Medusa,
Aligned Pair/Triple Exclusion, Forcing Chains y Forcing Nets, Nishio, Templating
(POM), Graded Equivalence Marks, Trial & Error / Guessing.

## 4. Escalera de dificultad propuesta

### 4.1 Base: la escala ER (Sudoku Explainer / Sukaku Explainer)

Escala verificada en el wiki de SukakuExplainer (v1.17.8 y SE v1.2.1):

| ER | Tecnica |
|---|---|
| 1.0 | Ultimo valor en caja/fila/columna (Full House / Last Digit) |
| 1.2 | Hidden Single en caja |
| 1.5 | Hidden Single en fila o columna |
| 1.7 | Direct Pointing (locked candidates tipo 1 que resuelve) |
| 1.9 | Direct Claiming (locked candidates tipo 2 que resuelve) |
| 2.0 | Direct Hidden Pair |
| 2.3 | Naked Single |
| 2.5 | Direct Hidden Triplet |
| 2.6 | Pointing (Locked Candidates tipo 1) |
| 2.8 | Claiming (Locked Candidates tipo 2) |
| 3.0 / 3.2 / 3.4 | Naked Pair / X-Wing / Hidden Pair |
| 3.6 / 3.8 / 4.0 | Naked Triplet / Swordfish / Hidden Triplet |
| 4.0-4.3 | Skyscraper, 2-String Kite, Turbot Crane |
| 4.2 / 4.4 | XY-Wing / XYZ-Wing |
| 4.5-5.3 | Unique rectangles y loops |
| 5.0 / 5.2 / 5.4 | Naked Quad / Jellyfish / Hidden Quad |
| 5.4-5.7 | 3 strong links techniques (incluye rings) |
| 5.5-5.6 | WXYZ-Wing (incluye double linked) |
| 5.6-6.0 | Bivalue Universal Graves |
| 5.8-6.1 | 4 strong links techniques |
| 6.2 / 6.2-6.5 | Aligned Pair Exclusion / 5 strong links |
| 6.5-6.9 | X-chains / X-cycles |
| 6.6-7.0 | Y-cycles |
| 7.0-8.0 | Bidirectional cycles |
| 7.1-7.5 | Forcing Chains |
| 7.6-8.1 | Nishio |
| 8.2+ | Forcing Chains dinamicas y superiores |

Fuente: wiki de SudokuMonster/SukakuExplainer (URLs en seccion 9).

### 4.2 Corte por nivel (propuesta)

| Nivel de juego | Tecnicas alcanzan | ER maximo | Comentario |
|---|---|---|---|
| **Facil** | Full House, Hidden Single, Naked Single | ~2.3 | Se resuelve "sin notar" que hay tecnicas: puro escaneo y conteo. Es el corte de "no requiere notas". |
| **Medio** | + Locked Candidates (Pointing/Claiming), Naked/Hidden Pair, Naked Triple | ~3.6 | Requiere notar candidatos. Es el primer nivel donde el juego deberia ofrecer auto-notes. |
| **Dificil** | + Hidden Triple, Naked Quad, X-Wing, Swordfish, XY-Wing, XYZ-Wing | ~4.4 | Umbral real de "dificil": hay que buscar patrones fuera de una sola unidad. Un jugador casual se traba aca. |
| **Experto** | + Unique Rectangle, Simple Colors, X-Chain, Skyscraper, 2-String Kite, W-Wing, Jellyfish, XY-Chain | ~7.0 | Requiere mirar cadenas, colores o razonar por unicidad. Es donde una app promedio "no te puede explicar". |
| **Fuera de v1** | ALS, Sue de Coq, BUG, Forcing Chains/Nets, Nishio, Fish con aleta | >7.0 | Se excluyen del juego (seccion 5). |

Criterio de asignacion para el generador (U2):
1. Resolver el puzzle con la lista ordenada de tecnicas, de menor a mayor ER.
2. El nivel = tier de la tecnica **mas dificil** usada.
3. Desempate por **cantidad** de pasos dificiles (un puzzle con 15 X-Wings no es
   igual a uno con 1). HoDoKu usa exactamente este patron: nivel = max(nivel del
   paso mas dificil) y ademas un *score* que suma todos los pasos.

**Advertencia importante (el desacuerdo, seccion 4.3)**: esto es el criterio
practico y comun, no una verdad demostrada.

### 4.3 Que hace "dificil" a un sudoku: el desacuerdo real

Hay tres posturas en juego y **no coinciden**:

1. **Conteo de huecos / pistas (givens)**. Muchos sitios etiquetan por cantidad
   de numeros dados. Es el criterio mas debil: Pelanek lo usa como "linea de base"
   y demuestra que varias metricas algoritmicas no logran superarlo, o incluso
   predicen peor. Datos: la cantidad minima de pistas de un sudoku bien formado es
   **17**, probado por busqueda exhaustiva (McGuire 2012); 17 pistas no implica
   facil ni dificil (Royle: "most sudokus [with 17 clues] are not very hard",
   segun HoDoKu). Conclusion: contar huecos **no** mide dificultad.

2. **Tecnicas requeridas** (escala ER, niveles de HoDoKu, "hardest technique").
   Es lo que usan la mayoria de los solvers y lo que la comunidad cita. No esta
   validado empiricamente de forma directa, pero es explicable, determinista y
   reproducible. HoDoKu explicita que "no puede dar una medida absoluta de
   dificultad (si tal cosa existe)".

3. **Rating humano** (tiempo o tasa de exito). Es la verdad de referencia.
   Pelanek (2014) midio ~1700 puzzles con cientos de solvers y llego a
   correlacion 0.95 con un modelo computacional, pero con dos hallazgos que
   importan:
   - La dificultad tiene **dos fuentes**: la complejidad de cada paso **y** la
     estructura de dependencia entre pasos (si se pueden aplicar en paralelo o
     hay que encadenarlos).
   - Una metrica que solo mira la tecnica mas dificil **ignora** la segunda
     fuente. Un puzzle con muchos pasos dependientes es mas dificil que la misma
     tecnica una sola vez.

4. **Postura de la comunidad de "que es un buen puzzle"**. HoDoKu documenta que
   el "SSTS" (Simple Sudoku Technique Set = Singles, Locked Candidates,
   Subsets, X-Wing, Swordfish, Jellyfish, XY-Wing, Simple Colors, Multi Colors)
   es "el conjunto de tecnicas usado en los foros para reducir un sudoku al punto
   donde empieza la diversion". Es decir: el umbral informal de "hasta aca es
   juego normal, de aca para arriba es para fanaticos" esta en el borde
   SSTS.

**Recomendacion para Kanam SUDOKU (juego personal)**:
- Usar **tecnicas requeridas** como criterio primario. Motivo: es el unico que
  el propio motor de hints ya puede calcular (U3 alimenta a U2), es determinista,
  testeable con `node --test`, y es explicable al jugador. La dificultad deja de
  ser una caja negra.
- **No** usar cantidad de huecos. Miente (seccion 4.3, punto 1).
- Complementar con el segundo factor de Pelanek de forma barata: contar pasos
  por tier y exigir, p.ej., que "dificil" tenga al menos 1 paso del tier dificil
  y "experto" combinaciones (no un solo W-Wing suelto). Esto evita que dos
  puzzles con el mismo ER maximo se sientan identicos.
- Dejar el rating humano como **calibracion futura** (opcional): si el juego
  registra tiempos por dificultad (FR-6 ya los guarda), se puede ajustar el corte
  a posteriori sin tocar el motor.
- Cuidado con los niveles de borde: un puzzle que se resuelve con singles pero
  tiene 50 pasos de hidden single no es "facil de un minuto". El tier dice **que**
  tecnica, no **cuanto tiempo**.

## 5. Fuera de alcance de la v1 y por que

Excluidos, con el motivo tecnico:

| Tecnica | Motivo de exclusion v1 |
|---|---|
| Finned / Sashimi / Franken / Mutant / Kraken Fish | Multiplican los patrones de la familia fish (aletas, cajas, conjuntos mixtos). El motor de fish basico ya cubre la progresion del jugador. |
| Multi-Colors / 3D Medusa / Advanced Coloring | Requieren multiples clusters y colores sobre varios digitos; la explicacion llana deja de ser viable. |
| Aligned Pair / Triple Exclusion | Enumeracion de combinaciones celda-celda; costo alto y explicacion larga. |
| Forcing Chains y Forcing Nets | Ramificacion de implicaciones ("si esto entonces aquello" en arbol). Es casi un solver de backtracking disfrazado; explica mal y contradice el espiritu del FR-9. |
| Nishio | Ensayo y error de un solo digito. Sudopedia lo lista bajo "tecnicas de ultimo recurso" y lo trata como controvertido. |
| Templating / POM, Graded Equivalence Marks | Herramientas de computadora, no de jugador. |
| ALS-XZ / ALS-Chain / Death Blossom | El "conjunto casi cerrado" no tiene traduccion llana honesta; el FR-9 pide explicar sin jerga. Se puede reevaluar en v2. |
| Sue de Coq | Igual que ALS, mas raro. |
| BUG / BUG+1 | Suposicion de unicidad + explicacion abstracta. La UR (que si incluyo) ya cubre la entrada a esa familia. |
| Trial & Error / Guessing / Backtracking | No es tecnica de jugador. |

Criterio general de exclusion: o (a) el motor no puede explicarlo en lenguaje
llano segun el FR-9, o (b) el costo de deteccion explota sin aportar a la
progresion del jugador, o (c) depende de supuestos (unicidad) que ya estan
representados por una tecnica incluida.

Sugerencia de v1 cerrada (para alinear U3): **3 singles + 2 locked candidates +
6 subsets (pair/triple/quad, naked y hidden) + 3 fish (X-Wing, Swordfish,
Jellyfish) + 2 wings (XY, XYZ) + 1 unicidad (UR Type 1) + 3 single-digit/chain
basicas (Skyscraper, 2-String Kite, Simple Colors) + X-Chain**. Son 23 tecnicas:
suficiente para cubrir de facil a experto sin entrar en lo inabordable.

## 6. Estructuras de deteccion que el motor necesita (para DEV)

### 6.1 Modelo base

- `values[81]`: 0 = vacio, 1..9 = valor. (U1)
- `candidates[81]`: **bitmask** de 9 bits (bit d-1 = digito d posible). Un entero
  por casilla. Permite intersecciones y conteos con operaciones de bits.
- `units[27]`: cada unidad = array de 9 indices de casilla (9 filas, 9 columnas,
  9 cajas).
- `unitsOfCell[81]`: las 3 unidades de cada casilla.
- `peers[81]`: los 20 indices vecinos de cada casilla (fila + columna + caja).
- `digitCells[d]`: set (bitmask de 81 bits, o array) de casillas con el digito d
  como candidato.

Derivados baratos:
- `cellCount[81]` = popcount de `candidates[c]`. `==1` -> naked single;
  `==2` -> bivaluada (base de naked pairs y wings).
- `unitDigitCells[u][d]`: casillas candidatas del digito d en la unidad u. Se usa
  para hidden singles, subsets, locked candidates, fish y strong links.
- **Strong links**: para cada digito d y unidad u con exactamente 2 candidatos ->
  arista entre esas 2 casillas (par conjugado). Es el grafo base de coloring,
  X-Chain, Skyscraper, 2-String Kite, W-Wing.

### 6.2 Requisito minimo de candidatos por tecnica

| Tecnica | Estructura minima | Nota |
|---|---|---|
| Full House / Last Digit | solo `values` | No necesita candidatos. |
| Hidden Single | `unitDigitCells` | 1 casilla para un digito en una unidad. |
| Naked Single | `candidates`, `cellCount` | 1 candidato. |
| Locked Candidates | `unitDigitCells` por caja y linea | 2-3 candidatos confinados a la interseccion. |
| Naked Pair/Triple/Quad | `candidates` + combinacion de 2/3/4 casillas | union de candidatos de tamaño N. |
| Hidden Pair/Triple/Quad | `unitDigitCells` | N digitos contenidos en las mismas N casillas. |
| X-Wing | `unitDigitCells` (lineas bilocales) | exactamente 2 por linea definidora. |
| Swordfish | `unitDigitCells` | 2-3 por linea, union de 3 lineas cruzadas. |
| Jellyfish | `unitDigitCells` | 2-4 por linea, union de 4 lineas cruzadas. |
| XY-Wing | bivaluadas + `peers` | 3 bivaluadas con patron XY/XZ/YZ. |
| XYZ-Wing | bivaluadas + trivaluadas + `peers` | pivote de 3 candidatos. |
| W-Wing | bivaluadas + strong links | 2 bivaluadas identicas + 1 strong link. |
| Skyscraper / 2-String Kite | strong links | 2 pares conjugados alineados / cruzados. |
| Empty Rectangle | `unitDigitCells` por caja + strong links | candidatos en L en una caja. |
| Simple Colors | strong links por digito | coloreo de paridad de componentes. |
| X-Chain | strong + weak links | busqueda de caminos alternados (>=4 casillas). |
| XY-Chain / Remote Pair | grafo de bivaluadas | busqueda de caminos. |
| Unique Rectangle | `candidates` por pares de lineas | 4 casillas con candidatos {a,b}. |
| BUG+1 | `candidates` global | conteo de ocurrencias. |

**Regla de oro para DEV**: todo lo que no sea single requiere la **grilla de
candidatos completa y correcta**. Los singles de hidden pueden buscarse incluso
sin auto-notes (por cross-hatching), pero el resto no. Esto justifica que FR-3
(calculo de candidatos del tablero) sea prerequisito de U3.

### 6.3 Contrato de salida que la UI necesita

Cada tecnica detectada deberia devolver una estructura tipo:

```
{
  technique: "HIDDEN_SINGLE",         // id estable
  tier: 0,                            // nivel de la escalera
  er: 1.5,                            // rating de referencia
  action: "place" | "eliminate",
  targets: [ {cell: 42, digit: 6, kind: "place"} ],
  evidence: {                          // que resaltar en el tablero
    unit: {type:"row", index:2},       // o box/col
    highlightCells: [42, 43, ...],
    digit: 6
  },
  text: "..."                          // explicacion llana ya armada
}
```

`action`, `targets` y `evidence` son lo que alimenta los hints (U7): la UI tiene
que poder resaltar la unidad, las casillas involucradas y el digito, ademas de
mostrar el `text`. Nota de accesibilidad (NFR-4): como el resaltado no puede
depender solo del color, la evidencia debe nombrar fila/columna/caja y digito en
texto y en ARIA.

### 6.4 Orden de evaluacion (prioridad del hint)

El FR-9 pide "la tecnica mas simple aplicable". Eso es simplemente recorrer la
lista ordenada por tier/ER y devolver la primera que aplique. La lista del
catalogo (seccion 2 y 3) ya esta en ese orden. Sugerencia: fijar el orden en un
unico array de configuracion, para que el generador (U2) y el hint (U3) compartan
la misma fuente de verdad.

## 7. Verificacion realizada

- Lei completas las paginas de Sudopedia de: Solving Technique, Naked Single,
  Hidden Single, Full House, Last Digit, Locked Candidates, Naked Subset, Naked
  Pair, Naked Triple, Naked Quad, Hidden Subset, Hidden Pair, Hidden Triple,
  Hidden Quad, Fish, X-Wing, Swordfish, Jellyfish, XY-Wing, XYZ-Wing, W-Wing,
  Skyscraper, 2-String Kite, X-Chain, Simple Colors, Coloring, Empty Rectangle,
  Unique Rectangle, Sue de Coq.
- Lei las tablas de rating de SukakuExplainer v1.17.8 y Sudoku Explainer v1.2.1.
- Lei la pagina de singles y de intersections de HoDoKu (via Wayback) y la de
  creacion/rating (via Wayback), de donde saque la definicion de SSTS, el
  mecanismo nivel+score, y la advertencia de que su rating es configurable, no
  absoluto.
- Lei el abstract y la introduccion de Pelanek 2014 (arXiv:1403.7373) y el
  abstract de Pelanek FLAIRS 2011 (correlacion 0.95, dos fuentes de dificultad).
- Lei el abstract de McGuire 2012 (arXiv:1201.0749), prueba de que el minimo es
  17 pistas.
- Lei el abstract y la introduccion de arXiv:2507.21137 (Project Patti, metricas
  SAT + Nishio hibrido, clasificacion universal easy/medium/hard).
- Comprobe la ausencia de guion largo (em dash) y guion medio (en dash) en este
  documento con un chequeo por codigo, segun la regla dura de Kanam MIND.

## 8. Incertidumbre y lo que no verifique

1. **Nomenclatura en español: NO CANONICA.** La comunidad hispanohablante no
   tiene una nomenclatura unica y estable. Los nombres en español de este
   documento son **traducciones propuestas**, no nombres establecidos. Lo unico
   canonico es el nombre en ingles. Recomendacion: usar el nombre en ingles como
   id interno y la traduccion solo como etiqueta de UI, versionada.
2. **Valores ER exactos de algunas tecnicas.** El ER del **W-Wing** aislado y de
   **Sue de Coq** no quedaron confirmados; la tabla de SE los agrupa (WXYZ-Wing
   5.5-5.6; Sue de Coq dentro de bloques de miscelaneas). **NO VERIFICADO.**
3. **Escala ER como verdad.** La escala ER es un criterio ad hoc muy citado, no
   validado empiricamente contra desempeño humano. Pelanek (2014) muestra que un
   modelo que ignora la estructura de dependencia entre pasos puede errar la
   prediccion. La escalera de la seccion 4 es una **propuesta defendible**, no un
   resultado experimental.
4. **La afirmacion "SSTS es el umbral donde empieza la diversion"** la tomo de
   HoDoKu (fuente secundaria de un proyecto de software, no de un paper). Es una
   opinion de la comunidad, no evidencia. La marco como tal.
5. **No corri ningun solver ni puzzle.** Todas las descripciones de deteccion son
   de documentacion, no de prueba ejecutada. En particular, los "minimos de
   candidatos" de la seccion 6.2 son **INFERENCIA** a partir de las definiciones
   (no los vi afirmados como "minimo" en ninguna fuente). Deben validarse con
   tests reales antes de cerrar U3.
6. **Conteo del "Project Patti" (arXiv:2507.21137).** Lei el abstract y la
   introduccion, pero los umbrales numericos exactos de su clasificador universal
   no los verifique (contenido truncado). Solo afirmo lo que dice el abstract.
7. **HoDoKu en vivo bloqueado.** Las paginas vivas de hodoku.sourceforge.net
   devolvieron 403 (Cloudflare). Use **snapshots de Wayback Machine**, que pueden
   estar desactualizados respecto del sitio original. El contenido citado
   (definiciones de singles/intersections/rating) es coherente entre snapshots de
   2024 y 2025, lo que da confianza, pero no es el original en vivo.
8. **Pelanek FLAIRS 2011 (PDF) no abrio** (timeout). Use su abstract via busqueda
   y la version 2014 (arXiv) para los dos hallazgos. El 0.95 exacto proviene del
   abstract de la version 2011; la version 2014 (que si abri) reporta 0.88 para
   el modelo simple y 0.95 combinando. Ambos coherentes, pero son papers
   distintos: no los mezcle en una sola cita.
9. **Nombres de familia y solapamientos.** Turbot Fish / Skyscraper / 2-String
   Kite / Empty Rectangle se solapan (Skyscraper es un Sashimi X-Wing, segun
   Sudopedia). El motor debe elegir **una** etiqueta por deteccion para no contar
   la misma jugada dos veces; que etiqueta gana es una decision de producto, no
   un hecho.
10. **No toque ningun otro archivo del repo** (sin commit, como pidio CORE).

## 9. Fuentes (URLs)

Todas abiertas y leidas en esta investigacion (2026-09-26), salvo las marcadas
como [via Wayback].

Referencia de tecnicas (Sudopedia, wiki de la comunidad):
- Solving Technique: https://sudopedia.sudocue.net/index.php?title=Solving_Technique
- Naked Single: https://sudopedia.sudocue.net/index.php?title=Naked_Single
- Hidden Single: https://sudopedia.sudocue.net/index.php?title=Hidden_Single
- Full House: https://sudopedia.sudocue.net/index.php?title=Full_House
- Last Digit: https://sudopedia.sudocue.net/index.php?title=Last_Digit
- Locked Candidates: https://sudopedia.sudocue.net/index.php?title=Locked_Candidates
- Naked Subset: https://sudopedia.sudocue.net/index.php?title=Naked_Subset
- Naked Pair: https://sudopedia.sudocue.net/index.php?title=Naked_Pair
- Naked Triple: https://sudopedia.sudocue.net/index.php?title=Naked_Triple
- Naked Quad: https://sudopedia.sudocue.net/index.php?title=Naked_Quad
- Hidden Subset: https://sudopedia.sudocue.net/index.php?title=Hidden_Subset
- Hidden Pair: https://sudopedia.sudocue.net/index.php?title=Hidden_Pair
- Hidden Triple: https://sudopedia.sudocue.net/index.php?title=Hidden_Triple
- Hidden Quad: https://sudopedia.sudocue.net/index.php?title=Hidden_Quad
- Fish: https://sudopedia.sudocue.net/index.php?title=Fish
- X-Wing: https://sudopedia.sudocue.net/index.php?title=X-Wing
- Swordfish: https://sudopedia.sudocue.net/index.php?title=Swordfish
- Jellyfish: https://sudopedia.sudocue.net/index.php?title=Jellyfish
- XY-Wing: https://sudopedia.sudocue.net/index.php?title=XY-Wing
- XYZ-Wing: https://sudopedia.sudocue.net/index.php?title=XYZ-Wing
- W-Wing: https://sudopedia.sudocue.net/index.php?title=W-Wing
- Skyscraper: https://sudopedia.sudocue.net/index.php?title=Skyscraper
- 2-String Kite: https://sudopedia.sudocue.net/index.php?title=2-String_Kite
- Empty Rectangle: https://sudopedia.sudocue.net/index.php?title=Empty_Rectangle
- X-Chain: https://sudopedia.sudocue.net/index.php?title=X-Chain
- Simple Colors: https://sudopedia.sudocue.net/index.php?title=Simple_Colors
- Coloring: https://sudopedia.sudocue.net/index.php?title=Coloring
- Unique Rectangle: https://sudopedia.sudocue.net/index.php?title=Unique_Rectangle
- Sue de Coq: https://sudopedia.sudocue.net/index.php?title=Sue_de_Coq

Escalas de rating:
- Sukaku Explainer v1.17.8: https://github.com/SudokuMonster/SukakuExplainer/wiki/Difficulty-Ratings-in-Sukaku-Explainer-v1.17.8
- Sudoku Explainer v1.2.1: https://github.com/SudokuMonster/SukakuExplainer/wiki/Difficulty-ratings-in-Sudoku-Explainer-v1.2.1

HoDoKu (via Wayback):
- Tecnicas (indice): https://web.archive.org/web/20240329132455/https://hodoku.sourceforge.net/en/techniques.php [via Wayback]
- Singles: https://web.archive.org/web/20241006175535/https://hodoku.sourceforge.net/en/tech_singles.php [via Wayback]
- Intersections: https://web.archive.org/web/20250116094108/https://hodoku.sourceforge.net/en/tech_intersections.php [via Wayback]
- Creacion / rating / SSTS: https://web.archive.org/web/20250826181725/https://hodoku.sourceforge.net/en/docs_cre.php [via Wayback]

Papers:
- Pelanek, "Difficulty Rating of Sudoku Puzzles: An Overview and Evaluation" (2014): https://arxiv.org/html/1403.7373v1
- Pelanek, "Difficulty Rating of Sudoku Puzzles by a Computational Model" (FLAIRS 2011): https://www.fi.muni.cz/~xpelanek/proso/documents/flairs-sudoku.pdf (abstract via https://aaai.org/papers/flairs-2011-2517/)
- McGuire et al., "There is no 16-Clue Sudoku" (2012): https://arxiv.org/abs/1201.0749
- Eisenkolb-Vaithyanathan, "Project Patti" (2025): https://arxiv.org/html/2507.21137
