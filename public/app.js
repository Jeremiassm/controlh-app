document.addEventListener('DOMContentLoaded', () => {
    console.log("ControlH vDefinitiva-FINAL cargado.");

    // --- ELEMENTOS PRINCIPALES DEL DOM ---
    const mainContent = document.getElementById('main-content');
    const homeLink = document.getElementById('home-title');
    const navButtonsContainer = document.querySelector('.row.g-3');
    const dayTasksModal = new bootstrap.Modal(document.getElementById('day-tasks-modal'));
    let calendar = null;
    const categorias = ["Sala", "Materiales", "Cultivos", "Interconsulta", "Alta", "Rx", "Laboratorio", "TNM", "POI", "PreQx", "CxHoy"];

    // --- NAVEGACIÓN Y ROUTING ---
    const renderView = (viewName, params = {}) => {
        if (calendar) {
            calendar.destroy();
            calendar = null;
        }
        mainContent.innerHTML = '';
        switch (viewName) {
            case 'pendientes': renderTareasPendientes(); break;
            case 'tareas': renderTareaForm(); break;
            case 'pacientes': renderPacientesView(); break;
            case 'editarPaciente': renderPacienteForm(params.id); break;
            case 'calendario': renderCalendar(); break;
            default: renderCalendar();
        }
    };

    // --- MANEJADORES DE EVENTOS ---
    homeLink.addEventListener('click', (e) => { e.preventDefault(); renderView('calendario'); });
    navButtonsContainer.addEventListener('click', (e) => {
        if (e.target.matches('[data-view]')) {
            e.preventDefault();
            renderView(e.target.dataset.view);
        }
    });

    mainContent.addEventListener('click', async (e) => {
        const target = e.target;
        const actionableTarget = target.matches('.complete-btn, .undo-btn, .edit-btn, .delete-btn, [data-cat]');
        if (actionableTarget) e.preventDefault();
        
        if (target.matches('.complete-btn')) await updateTaskStatus(target.dataset.id, 'terminada');
        if (target.matches('.undo-btn')) await updateTaskStatus(target.dataset.id, 'en curso');
        if (target.matches('.edit-btn')) renderView('editarPaciente', { id: target.dataset.id });
        if (target.matches('.delete-btn')) {
            if (confirm('¿Seguro que quieres eliminar este paciente?')) {
                await fetch(`/api/pacientes/${target.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
                renderView('pacientes');
            }
        }
        if (target.matches('[data-cat]')) fetchTareasPorCategoria(target.dataset.cat);
    });

    mainContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());

        if (form.id === 'form-tarea') {
            await fetch('/api/tareas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'same-origin' });
            alert('Tarea guardada');
            renderView('pendientes');
        }
        if (form.id === 'paciente-form') {
            const id = form.dataset.id;
            const url = id ? `/api/pacientes/${id}` : '/api/pacientes';
            const method = id ? 'PUT' : 'POST';
            await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'same-origin' });
            renderView('pacientes');
        }
    });

    // --- FUNCIONES DE LÓGICA ---
    const updateTaskStatus = async (id, estado) => {
        await fetch(`/api/tareas/${id}/estado`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }), credentials: 'same-origin' });
        renderTareasPendientes();
    };

    // --- FUNCIONES PARA DIBUJAR VISTAS ---
    async function renderCalendar() {
        mainContent.innerHTML = `<div id="calendar">Cargando...</div>`;
        const calendarEl = document.getElementById('calendar');
        try {
            const response = await fetch('/api/tareas/all', { credentials: 'same-origin' });
            const { data } = await response.json();
            const events = data.map(t => ({ id: t.id, title: `(${t.categoria}) ${t.descripcion}`, start: t.fecha_creacion, color: t.estado === 'terminada' ? '#198754' : '#0d6efd' }));
            
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth', locale: 'es', height: 'auto', events: events,
                dateClick: (info) => {
                    const tasksOfDay = events.filter(e => e.start.startsWith(info.dateStr));
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
        mainContent.innerHTML = `<h2>Tareas del Día y Pendientes</h2><p>Cargando...</p>`;
        try {
            const res = await fetch('/api/tareas/all', { credentials: 'same-origin' });
            const { data } = await res.json();
            const hoy = new Date().toISOString().slice(0, 10);
            const tareasAMostrar = data.filter(t => t.estado === 'en curso' || t.fecha_creacion.startsWith(hoy));
            tareasAMostrar.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
            let content = `<h2>Tareas del Día y Pendientes</h2>`;
            if (tareasAMostrar.length === 0) content += '<p>¡Excelente! No hay tareas para hoy.</p>';
            else {
                content += `<div class="item-list">${tareasAMostrar.map(t => {
                    const isTerminada = t.estado === 'terminada';
                    return `<div class="list-item ${isTerminada ? 'terminada' : 'en-curso'}">
                        <div><strong>${t.descripcion}</strong><br><small><b>Paciente:</b> ${t.paciente_nombre || 'N/A'}</small></div>
                        <div class="item-actions">
                            ${isTerminada ? `<button class="btn btn-sm btn-warning undo-btn" data-id="${t.id}">↺</button>` : `<button class="btn btn-sm btn-success complete-btn" data-id="${t.id}">✔</button>`}
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
        const res = await fetch('/api/pacientes', { credentials: 'same-origin' });
        const { data } = await res.json();
        list.innerHTML = data.length > 0 ? data.map(p => `<div class="list-item"><div><strong>${p.nombre}</strong><br><small>Hab: ${p.habitacion || 'N/A'}</small></div><div class="item-actions"><button class="btn btn-sm btn-warning edit-btn" data-id="${p.id}">Editar</button> <button class="btn btn-sm btn-danger delete-btn" data-id="${p.id}">Eliminar</button></div></div>`).join('') : '<p>No hay pacientes.</p>';
    }

    async function renderPacienteForm(id) {
        const res = await fetch(`/api/pacientes/${id}`, { credentials: 'same-origin' });
        const { data: p } = await res.json();
        mainContent.innerHTML = `<h2>Editando Paciente</h2><form id="paciente-form" data-id="${id}"><div class="mb-3"><label class="form-label">Nombre</label><input class="form-control" name="nombre" value="${p.nombre}" required></div><div class="mb-3"><label class="form-label">Habitación</label><input class="form-control" name="habitacion" value="${p.habitacion || ''}"></div><button class="btn btn-primary" type="submit">Guardar</button></form>`;
    }

    async function renderTareaForm() {
        const res = await fetch('/api/pacientes', { credentials: 'same-origin' });
        const { data: pacientes } = await res.json();
        mainContent.innerHTML = `<h2>Agregar Tarea</h2><form id="form-tarea"><textarea class="form-control" name="descripcion" placeholder="Descripción..." required></textarea><select class="form-select" name="categoria" required><option value="" selected disabled>Categoría...</option>${categorias.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><select class="form-select" name="paciente_id" required><option value="" selected disabled>Paciente...</option>${pacientes.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('')}</select><button class="btn btn-success" type="submit">Guardar Tarea</button></form>`;
    }
    
    function renderCategorias() {
        mainContent.innerHTML = `<h2>Categorías</h2><div class="mobile-nav mb-3">${categorias.map(cat => `<button class="btn btn-secondary" data-cat="${cat}">${cat}</button>`).join('')}</div><div id="categoria-tareas"></div>`;
    }

    async function fetchTareasPorCategoria(categoria) {
        const contenedor = document.getElementById('categoria-tareas');
        contenedor.innerHTML = `<p>Cargando tareas de <strong>${categoria}</strong>...</p>`;
        try {
            const res = await fetch(`/api/tareas/categoria/${encodeURIComponent(categoria)}`, { credentials: 'same-origin' });
            const { data } = await res.json();
            contenedor.innerHTML = `<h4 class="mt-3">Tareas de ${categoria}</h4>` + (data.length ? `<div class="item-list">${data.map(t => `<div class="list-item en-curso"><div><strong>${t.descripcion}</strong><br><small><b>Paciente:</b> ${t.paciente_nombre} (Hab: ${t.paciente_habitacion || '-'})</small></div></div>`).join('')}</div>` : `<p>No hay tareas de <strong>${categoria}</strong> en curso.</p>`);
        } catch (error) { contenedor.innerHTML = `<p>Error al cargar las tareas.</p>`; }
    }

    // --- VISTA INICIAL ---
    renderView('calendario');
});