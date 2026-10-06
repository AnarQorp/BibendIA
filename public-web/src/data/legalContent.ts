export interface LegalDocument {
  id: 'legal' | 'privacy' | 'cookies';
  title: string;
  badge: string;
  updatedAt: string;
  sections: {
    heading: string;
    content: string[];
    list?: string[];
  }[];
}

export const LEGAL_NOTICE_DATA: LegalDocument = {
  id: 'legal',
  title: 'Aviso Legal',
  badge: 'LSSI-CE y Sociedad de la Información',
  updatedAt: 'Octubre 2026',
  sections: [
    {
      heading: '1. Datos identificativos del titular',
      content: [
        'En cumplimiento con el deber de información recogido en el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y del Comercio Electrónico (LSSI-CE), se facilitan a continuación los datos informativos del titular de este sitio web:',
        'Titular / Denominación: BibendIA Technologies (en proceso de formalización societaria definitiva)',
        'Actividad: Desarrollo e implantación de software y soluciones de inteligencia artificial para la recepción y gestión de talleres mecánicos de automoción.',
        'Sitio web oficial: https://bibendia.com',
        'Correo electrónico de contacto: info@bibendia.com',
      ],
    },
    {
      heading: '2. Objeto y ámbito de aplicación',
      content: [
        'El presente Aviso Legal regula el acceso, navegación y uso del sitio web https://bibendia.com (en adelante, el "Sitio Web"), así como las responsabilidades derivadas de la utilización de sus contenidos.',
        'La navegación por el Sitio Web atribuye la condición de Usuario e implica la aceptación plena y sin reservas de todas las disposiciones incluidas en este Aviso Legal en la versión publicada en el momento de acceso.',
      ],
    },
    {
      heading: '3. Condiciones de uso',
      content: [
        'El Usuario se compromete a hacer un uso lícito, diligente y correcto de los contenidos y servicios de BibendIA, de conformidad con la ley, la moral, el orden público y las presentes condiciones.',
        'Queda expresamente prohibido:',
      ],
      list: [
        'Realizar actividades ilícitas, ilegales o contrarias a la buena fe y al orden público.',
        'Introducir o difundir en la red programas maliciosos (virus, troyanos, scripts perjudiciales) susceptibles de provocar daños en los sistemas informáticos de BibendIA o de terceros.',
        'Intentar acceder, utilizar o manipular las cuentas, datos o sistemas de otros usuarios o de la infraestructura del servicio sin autorización.',
        'Utilizar los formularios de contacto o solicitud de pruebas piloto para remitir comunicaciones comerciales no solicitadas (spam).',
      ],
    },
    {
      heading: '4. Propiedad intelectual e industrial',
      content: [
        'Todos los contenidos del Sitio Web, incluyendo a título enunciativo pero no limitativo textos, logotipos, marcas, diseños gráficos, código fuente, iconos, imágenes y software, son titularidad exclusiva de BibendIA o de terceros que han autorizado debidamente su uso.',
        'Quedan expresamente reservados todos los derechos de explotación. La reproducción, distribución, comunicación pública o transformación de cualquier contenido de este sitio sin la previa autorización escrita del titular queda totalmente prohibida al amparo de la legislación sobre propiedad intelectual.',
      ],
    },
    {
      heading: '5. Exclusión de garantías y responsabilidad',
      content: [
        'BibendIA adopta medidas técnicas y organizativas para garantizar el correcto funcionamiento del Sitio Web. No obstante, no garantiza la total disponibilidad, continuidad o infalibilidad técnica del servicio frente a contingencias o interrupciones imprevistas ajenas a su control razonable.',
        'BibendIA no se responsabiliza de los daños o perjuicios que pudieran derivarse de interferencias, omisiones, interrupciones, virus informáticos o desconexiones en las redes de telecomunicaciones ajenas al titular.',
      ],
    },
    {
      heading: '6. Enlaces a terceros',
      content: [
        'En caso de que en el Sitio Web se dispongan enlaces o hipervínculos hacia otros sitios de Internet, BibendIA no ejercerá ningún tipo de control sobre dichos sitios y contenidos, ni asumirá responsabilidad alguna por los contenidos de enlaces ajenos.',
      ],
    },
    {
      heading: '7. Legislación aplicable y jurisdicción',
      content: [
        'Para la resolución de cualquier controversia o cuestión relativa al presente sitio web o a las actividades en él desarrolladas, será de aplicación la legislación española vigente, sometiéndose las partes expresamente a la jurisdicción de los Juzgados y Tribunales competentes con arreglo a derecho.',
      ],
    },
  ],
};

export const PRIVACY_POLICY_DATA: LegalDocument = {
  id: 'privacy',
  title: 'Política de Privacidad',
  badge: 'RGPD (UE 2016/679) y LOPDGDD',
  updatedAt: 'Octubre 2026',
  sections: [
    {
      heading: '1. Responsable del tratamiento',
      content: [
        'En cumplimiento del Reglamento General de Protección de Datos (RGPD UE 2016/679) y de la Ley Orgánica 3/2018 (LOPDGDD), se informa de que los datos de carácter personal recabados a través de este sitio web serán tratados bajo la responsabilidad de:',
        'Identidad: BibendIA',
        'Finalidad del sitio: Solución de recepción inteligente y gestión para talleres de automoción.',
        'Correo electrónico de contacto y privacidad: info@bibendia.com',
      ],
    },
    {
      heading: '2. Datos recabados y finalidades del tratamiento',
      content: [
        'Los datos personales recopilados a través de los formularios del Sitio Web (específicamente la solicitud de prueba piloto y demo para talleres) incluyen: nombre de la persona de contacto, nombre del taller, número de teléfono y dirección de correo electrónico.',
        'Dichos datos se tratan exclusivamente con las siguientes finalidades:',
      ],
      list: [
        'Gestionar la solicitud de contacto, información o acceso al programa piloto formulada por el taller interesado.',
        'Establecer comunicación directa para coordinar demostraciones, evaluar compatibilidad con el sistema de gestión del taller y presentar la solución tecnológica.',
        'Atender dudas y ofrecer soporte precomercial y técnico relacionado con BibendIA.',
      ],
    },
    {
      heading: '3. Legitimación del tratamiento',
      content: [
        'La base jurídica es la aplicación, a petición del interesado, de medidas precontractuales relacionadas con su solicitud de información, demo o prueba piloto (artículo 6.1.b del RGPD). Cuando un tratamiento adicional requiera consentimiento, este se solicitará de forma separada y podrá retirarse en cualquier momento.',
      ],
    },
    {
      heading: '4. Plazo de conservación de los datos',
      content: [
        'Los datos personales facilitados se conservarán durante el tiempo estrictamente necesario para atender la solicitud comercial o prueba piloto planteada y, en su caso, mientras se mantenga la relación comercial o de colaboración con el taller.',
        'Posteriormente, los datos se conservarán debidamente bloqueados durante los plazos legalmente exigibles para la atención de posibles responsabilidades derivadas del tratamiento.',
      ],
    },
    {
      heading: '5. Destinatarios y transferencias internacionales',
      content: [
        'Los datos no se cederán a terceras entidades ni se comercializarán bajo ninguna circunstancia, salvo en caso de obligación legal o cuando sea necesario para proveedores tecnológicos que actúen como encargados del tratamiento bajo rigurosos acuerdos de confidencialidad y cumplimiento normativo europeo.',
        'No se prevén transferencias internacionales de datos fuera del Espacio Económico Europeo sin las garantías adecuadas establecidas por el RGPD.',
      ],
    },
    {
      heading: '6. Derechos del usuario',
      content: [
        'La normativa de protección de datos le otorga los siguientes derechos:',
      ],
      list: [
        'Derecho de acceso: conocer qué datos personales suyos estamos tratando.',
        'Derecho de rectificación: solicitar la modificación de datos inexactos o incompletos.',
        'Derecho de supresión ("derecho al olvido"): solicitar la eliminación de sus datos cuando ya no sean necesarios para los fines que fueron recabados.',
        'Derecho de oposición: oponerse al tratamiento de sus datos cuando concurran motivos relacionados con su situación particular.',
        'Derecho de limitación del tratamiento: solicitar la limitación temporal del uso de sus datos en los supuestos previstos por la ley.',
        'Derecho a la portabilidad: recibir sus datos en un formato estructurado y de lectura mecánica.',
      ],
    },
    {
      heading: '7. Ejercicio de derechos y reclamaciones',
      content: [
        'Para ejercer cualquiera de los derechos anteriores, el usuario puede remitir una solicitud por correo electrónico a la dirección info@bibendia.com indicando la referencia "Protección de Datos - Derechos RGPD" y acreditando debidamente su identidad.',
        'Asimismo, si considera que el tratamiento de sus datos no se ajusta a la normativa vigente, tiene derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD, www.aepd.es).',
      ],
    },
  ],
};

export const COOKIE_POLICY_DATA: LegalDocument = {
  id: 'cookies',
  title: 'Cookies y almacenamiento local',
  badge: 'Información técnica de privacidad',
  updatedAt: 'Octubre 2026',
  sections: [
    {
      heading: '1. Uso actual de cookies',
      content: [
        'La web pública de BibendIA no utiliza actualmente cookies analíticas, publicitarias ni de personalización, y no incorpora herramientas de seguimiento de terceros.',
      ],
    },
    {
      heading: '2. Almacenamiento local técnico',
      content: [
        'El sitio guarda únicamente la clave técnica bibendia_storage_notice_v1 en el almacenamiento local del navegador (localStorage). Su finalidad exclusiva es recordar que el usuario ya ha visto el aviso de privacidad y evitar mostrarlo en cada visita.',
        'La clave contiene una marca de confirmación y la fecha y hora en que se pulsó “Entendido”. No contiene identificadores publicitarios, información del formulario ni datos de navegación, y permanece hasta que el usuario borra los datos del sitio desde su navegador.',
      ],
    },
    {
      heading: '3. Formulario de solicitud',
      content: [
        'La protección frente a envíos duplicados del formulario se gestiona temporalmente en la memoria de la página mientras se realiza el intento. No crea una cookie ni una entrada persistente en localStorage o sessionStorage.',
        'Los datos que el usuario envía mediante el formulario se transmiten al servicio de BibendIA para atender la solicitud, conforme a la Política de Privacidad, pero no se guardan en el almacenamiento local del navegador por esta funcionalidad.',
      ],
    },
    {
      heading: '4. Cómo borrar el almacenamiento local',
      content: [
        'El usuario puede eliminar en cualquier momento la marca técnica desde la configuración de datos del sitio de su navegador. Al hacerlo, el aviso volverá a mostrarse en la siguiente visita.',
      ],
      list: [
        'Google Chrome y Microsoft Edge: Configuración > Privacidad y seguridad > Datos de sitios.',
        'Mozilla Firefox: Ajustes > Privacidad y seguridad > Cookies y datos del sitio.',
        'Apple Safari: Ajustes > Privacidad > Gestionar datos de sitios web.',
      ],
    },
  ],
};
