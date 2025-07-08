// ==================================================================
// === CONTROLH APP.JS - VERSIÓN ESTABLE Y DEFINITIVA ===
// ==================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("ControlH vDefinitiva cargado y listo.");

    // --- ELEMENTOS PRINCIPALES DEL DOM ---
    const mainContent = document.getElementById('main-content');
    const homeTitle = document.getElementById('home-title');
    const navButtons = document.querySelectorAll('[data-view]');
    const dayTasksModal = new bootstrap.Modal(document.getElementById('day-tasks-modal'));
    
    let calendar = null; // Variable para manejar la instancia del calendario
    const categorias = ["Sala", "Materiales", "Cultivos", "Interconsulta", "Alta", "Rx", "Laboratorio", "TNM", "POI", "PreQx", "CxHoy"];

    // --- NAVEGACIÓN Y ROUTING ---
    const renderView = (viewName, params = {}) => {
        if (calendar) {
            calendar.destroy(); // Siempre destruye el calendario al cambiar de vista para evitar errores
            calendar = null;
        }
        mainContent.innerHTML = ''; // Limpia la vista anterior

        switch (viewName) {
            case 'pendientes': renderTareasPendientes(); break;
            case 'tareas': renderTareaForm(); break;
            case 'pacientes': renderPacientesView(); break;
            case 'editarPaciente': renderPacienteForm(params.id); break;
            case 'categorias': renderCategorias(); break;
            case 'calendario': renderCalendar(); break;
            default: renderCalendar(); // La vista por defecto es el calendario
        }
    };

    // Navegación principal (botones y título)
    navButtons.forEach(button => button.addEventListener('click', () => renderView(button.dataset.view)));
    homeTitle.addEventListener('click', () => renderView('calendario'));


    // --- MANEJADOR DE EVENTOS GLOBAL Y ÚNICO ---
    // Un solo listener para todas las acciones de clic dentro del área principal
    mainContent.addEventListener('click', async (e) => {
        const target = e.target;
        
        // No prevenir la acción por defecto si el clic no es en un botón o enlace accionable
        const actionableTarget = target.matches('.complete-btn, .undo-btn, .edit-btn, .delete-btn, [data-cat]');
        if (actionableTarget) {
            e.preventDefault();
        }

        // Marcar tarea como TERMINADA
        if (target.matches('.complete-btn')) await updateTaskStatus(target.dataset.id, 'terminada');
        
        // Marcar tarea como EN CURSO (Deshacer)
        if (target.matches('.undo-btn')) await updateTaskStatus(target.dataset.id, 'en curso');
        
        // Editar Paciente
        if (target.matches('.edit-btn')) renderView('editarPaciente', { id: target.dataset.id });

        // Eliminar Paciente
        if (target.matches('.delete-btn')) {
            if (confirm('¿Seguro que quieres eliminar este paciente?')) {
                await fetch(`/api/pacientes/${target.dataset.id}`, { method: 'DELETE' });
                renderView('pacientes');
            }
        }
        
        // Ver tareas por Categoría
        if (target.matches('[data-cat]')) fetchTareasPorCategoria(target.dataset.cat);
    });

    // Un solo listener para todos los envíos de formularios
    mainContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());

        // Formulario de Tareas
        if (form.id === 'form-tarea') {
            await fetch('/api/tareas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            alert('Tarea guardada');
            renderView('pendientes');
        }

        // Formulario de Pacientes (tanto para crear como para editar)
        if (form.id === 'paciente-form') {
            const id = form.dataset.id;
            const url = id ? `/api/pacientes/${id}` : '/api/pacientes';
            const method = id ? 'PUT' : 'POST';
            await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            renderView('pacientes');
        }
    });

    // --- FUNCIONES DE LÓGICA ---
    async function updateTaskStatus(id, estado) {
        await fetch(`/api/tareas/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        renderTareasPendientes(); // Siempre refresca la lista de pendientes después de un cambio
    }

    // --- FUNCIONES QUE DIBUJAN CADA VISTA ---

    async function renderCalendar() {
        mainContent.innerHTML = `<div id="calendar">Cargando calendario...</div>`;
        const calendarEl = document.getElementById('calendar');
        try {
            const response = await fetch('/api/tareas/all');
            const { data } = await response.json();
            const events = data.map(tarea => ({
                id: tarea.id,
                title: `(${tarea.categoria}) ${tarea.descripcion}`,
                start: tarea.fecha_creacion,
                color: tarea.estado === 'terminada' ? '#198754' : '#0d6efd'
            }));
            
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'es',
                height: 'auto',
                events: events,
                dateClick: (info) => {
                    const tasksOfDay = events.filter(event => event.start.startsWith(info.dateStr));
                    document.getElementById('modal-title').textContent = `Tareas del ${info.dateStr}`;
                    document.getElementById('modal-body').innerHTML = tasksOfDay.length ? 
                        '<ul class="list-group">' + tasksOfDay.map(e => `<li class="list-group-item">${e.title}</li>`).join('') + '</ul>' :
                        '<p>No hay tareas registradas en esta fecha.</p>';
                    dayTasksModal.show();
                }
            });
            calendar.render();
        } catch (error) { mainContent.innerHTML = `<h2>Error al cargar el calendario</h2>`; }
    }

    async function renderTareasPendientes() {
        mainContent.innerHTML = '<h2>Tareas del Día y Pendientes</h2><p>Cargando...</p>';
        try {
            const res = await fetch('/api/tareas/all');
            const { data } = await res.json();
            const hoy = new Date().toISOString().slice(0, 10);
            const tareasAMostrar = data.filter(t => t.estado === 'en curso' || t.fecha_creacion.startsWith(hoy));
            tareasAMostrar.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
            
            let content = `<h2>Tareas del Día y Pendientes</h2>`;
            if (tareasAMostrar.length === 0) {
                content += '<p>¡Excelente! No hay tareas para hoy.</p>';
            } else {
                content += `<div class="item-list">${tareasAMostrar.map(t => {
                    const isTerminada = t.estado === 'terminada';
                    return `<div class="list-item ${isTerminada ? 'terminada' : 'en-curso'}">
                        <div><strong>${t.descripcion}</strong><br><small><b>Paciente:</b> ${t.paciente_nombre || 'N/A'}</small></div>
                        <div class="item-actions">
                            ${isTerminada ? `<button class="btn btn-sm btn-warning undo-btn" data-id="${t.id}">↺ Deshacer</button>` : `<button class="btn btn-sm btn-success text-dark complete-btn" data-id="${t.id}">✔ Terminar</button>`}
                        </div>
                    </div>`;
                }).join('')}</div>`;
            }
            mainContent.innerHTML = content;
        } catch (err) { mainContent.innerHTML = '<p>Error al cargar las tareas.</p>'; }
    }

    async function renderPacientesView() {
        mainContent.innerHTML = `<h2>Gestión de Pacientes</h2><form id="paciente-form" class="mb-4"><div class="row g-2"><div class="col-md"><input class="form-control" name="nombre" placeholder="Nombre y Apellido" required></div><div class="col-md"><input class="form-control" name="habitacion" placeholder="Habitación"></div><div class="col-md-auto"><button class="btn btn-success w-100" type="submit">Agregar</button></div></div></form><h3>Listado</h3><div class="item-list" id="pacientes-list">Cargando...</div>`;
        const list = document.getElementById('pacientes-list');
        const res = await fetch('/api/pacientes');
        const { data } = await res.json();
        list.innerHTML = data.length ? data.map(p => `<div class="list-item"><div><strong>${p.nombre}</strong><br><small>Hab: ${p.habitacion || 'N/A'}</small></div><div class="item-actions"><button class="btn btn-sm btn-warning edit-btn" data-id="${p.id}">Editar</button> <button class="btn btn-sm btn-danger text-dark delete-btn" data-id="${p.id}">Eliminar</button></div></div>`).join('') : '<p>No hay pacientes.</p>';
    }

    async function renderPacienteForm(id) {
        const res = await fetch(`/api/pacientes/${id}`);
        const { data: p } = await res.json();
        mainContent.innerHTML = `<h2>Editando Paciente</h2><form id="paciente-form" data-id="${id}"><div class="mb-3"><label class="form-label">Nombre</label><input class="form-control" name="nombre" value="${p.nombre}" required></div><div class="mb-3"><label class="form-label">Habitación</label><input class="form-control" name="habitacion" value="${p.habitacion || ''}"></div><button class="btn btn-primary" type="submit">Guardar</button></form>`;
    }

    async function renderTareaForm() {
        const res = await fetch('/api/pacientes');
        const { data: pacientes } = await res.json();
        mainContent.innerHTML = `<h2>Agregar Tarea</h2><form id="form-tarea"><textarea class="form-control" name="descripcion" placeholder="Descripción..." required></textarea><select class="form-select" name="categoria" required><option value="" selected disabled>Categoría...</option>${categorias.map(c => `<option value="${c}">${c}</option>`).join('')}</select><select class="form-select" name="paciente_id" required><option value="" selected disabled>Paciente...</option>${pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}</select><button class="btn btn-success" type="submit">Guardar Tarea</button></form>`;
    }
    
    function renderCategorias() {
        mainContent.innerHTML = `<h2>Categorías</h2><div class="mobile-nav mb-3">${categorias.map(cat => `<button class="btn btn-secondary" data-cat="${cat}">${cat}</button>`).join('')}</div><div id="categoria-tareas"></div>`;
    }

    async function fetchTareasPorCategoria(categoria) {
        const contenedor = document.getElementById('categoria-tareas');
        contenedor.innerHTML = `<p>Cargando tareas de <strong>${categoria}</strong>...</p>`;
        try {
            const res = await fetch(`/api/tareas/categoria/${encodeURIComponent(categoria)}`);
            const { data } = await res.json();
            contenedor.innerHTML = `<h4 class="mt-3">Tareas de ${categoria}</h4>` + (data.length ? `<div class="item-list">${data.map(t => `<div class="list-item en-curso">...</div>`).join('')}</div>` : `<p>No hay tareas de <strong>${categoria}</strong> en curso.</p>`);
        } catch (error) { contenedor.innerHTML = `<p>Error al cargar las tareas.</p>`; }
    }

    // --- VISTA INICIAL ---
    renderView('calendario');
});