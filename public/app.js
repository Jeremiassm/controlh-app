document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('.sidebar');
    // Referencia a la modal de Bootstrap
    const dayTasksModal = new bootstrap.Modal(document.getElementById('day-tasks-modal'));

    const categorias = ["Sala", "Materiales", "Cultivos", "Interconsulta", "Alta", "RX", "Laboratorio", "TNM", "POI", "PreQX", "CxHOY", "Otro"];

    // --- NAVEGACIÓN ---
    sidebar.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const view = e.target.dataset.view;
            renderView(view);
        }
        if (e.target.tagName === 'H1') {
            renderView('calendario');
        }
    });

    function renderView(viewName, params = {}) {
        switch (viewName) {
            case 'pacientes': renderPacientesView(); break;
            case 'categorias': renderCategoriasView(); break;
            case 'tareas': renderTareasForm(); break;
            case 'editarPaciente': renderPacientesForm(params.id); break;
            default: renderCalendarioView();
        }
    }

    // --- VISTAS ---

   // **** REEMPLAZA ESTA FUNCIÓN EN app.js ****
    function renderCalendarioView() {
        mainContent.innerHTML = '<h2>Calendario General</h2><div id="calendar"></div>';
        const calendarEl = document.getElementById('calendar');

        // ---- Lógica para el calendario responsivo ----
        const isMobile = window.innerWidth < 768;

        const calendar = new FullCalendar.Calendar(calendarEl, {
            // Opciones condicionales basadas en el tamaño de la pantalla
            initialView: isMobile ? 'listWeek' : 'dayGridMonth', // ¡Vista de lista en móvil!
            headerToolbar: isMobile ? {
                left: 'prev,next',
                center: 'title',
                right: 'today'
            } : {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            // ---------------------------------------------
            
            locale: 'es',
            events: '/api/tareas/all',
            
            dateClick: async function(info) {
                const modalTitle = document.getElementById('modal-title');
                const modalBody = document.getElementById('modal-body');

                modalTitle.textContent = `Tareas del ${info.dateStr}`;
                modalBody.innerHTML = 'Cargando...';
                dayTasksModal.show();

                const response = await fetch('/api/tareas/all');
                const { data: allTasks } = await response.json();
                
                const tasksOfDay = allTasks.filter(task => task.fecha_creacion.startsWith(info.dateStr));

                if (tasksOfDay.length > 0) {
                    modalBody.innerHTML = '<ul class="list-group">' + tasksOfDay.map(task => 
                        `<li class="list-group-item"><strong>${task.descripcion}</strong><br><small>Paciente: ${task.paciente_nombre || 'N/A'} | Estado: ${task.estado}</small></li>`
                    ).join('') + '</ul>';
                } else {
                    modalBody.innerHTML = '<p>No se cargaron tareas en esta fecha.</p>';
                }
            }
        });
        calendar.render();
    }

    async function renderPacientesView() {
        mainContent.innerHTML = `
            <h2>Gestión de Pacientes</h2>
            <form id="paciente-form">
                <input class="form-control" type="text" name="nombre" placeholder="Nombre del Paciente" required>
                <input class="form-control" type="text" name="habitacion" placeholder="Habitación">
                <button class="btn btn-success" type="submit">Agregar Paciente</button>
            </form>
            <div class="item-list" id="pacientes-list">Cargando...</div>
        `;
        const list = document.getElementById('pacientes-list');
        const response = await fetch('/api/pacientes');
        const { data } = await response.json();
        list.innerHTML = data.map(p => `
            <div class="list-item">
                <div><strong>${p.nombre}</strong><br><small>Habitación: ${p.habitacion || 'N/A'}</small></div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-warning edit-btn" data-id="${p.id}">Editar</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${p.id}">Eliminar</button>
                </div>
            </div>
        `).join('');
    }

    async function renderPacientesForm(id) {
        const isEditing = id !== undefined;
        const paciente = isEditing ? (await (await fetch(`/api/pacientes/${id}`)).json()).data : { nombre: '', habitacion: '' };
        mainContent.innerHTML = `
            <h2>${isEditing ? 'Editar' : 'Agregar'} Paciente</h2>
            <form id="paciente-form" data-id="${id || ''}">
                <input class="form-control" type="text" name="nombre" placeholder="Nombre" value="${paciente.nombre}" required>
                <input class="form-control" type="text" name="habitacion" placeholder="Habitación" value="${paciente.habitacion || ''}">
                <button class="btn btn-success" type="submit">${isEditing ? 'Guardar Cambios' : 'Agregar Paciente'}</button>
            </form>
        `;
    }

    async function renderTareasForm() {
        const response = await fetch('/api/pacientes');
        const { data: pacientes } = await response.json();
        mainContent.innerHTML = `
            <h2>Agregar Nueva Tarea</h2>
            <form id="tarea-form">
                <textarea class="form-control" name="descripcion" placeholder="Descripción de la tarea" required></textarea>
                <select class="form-select" name="categoria" required>
                    <option value="" disabled selected>Seleccione categoría...</option>
                    ${categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <select class="form-select" name="paciente_id" required>
                    <option value="" disabled selected>Seleccione paciente...</option>
                    ${pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                </select>
                <button class="btn btn-success" type="submit">Guardar Tarea</button>
            </form>
        `;
    }
    
    async function renderCategoriasView() {
        mainContent.innerHTML = `
            <h2>Categorías</h2>
            <div class="d-flex flex-wrap gap-2">
                ${categorias.map(c => `<button class="btn btn-outline-primary category-btn" data-categoria="${c}">${c}</button>`).join('')}
            </div>
            <hr>
            <div class="item-list" id="category-task-list">Seleccione una categoría para ver sus tareas.</div>
        `;
    }

    // --- MANEJO DE EVENTOS ---
    mainContent.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.matches('.edit-btn')) renderView('editarPaciente', { id: target.dataset.id });
        if (target.matches('.delete-btn')) {
            if (confirm('¿Seguro?')) {
                await fetch(`/api/pacientes/${target.dataset.id}`, { method: 'DELETE' });
                renderView('pacientes');
            }
        }
        if (target.matches('.category-btn')) {
            const categoria = target.dataset.categoria;
            const list = document.getElementById('category-task-list');
            const response = await fetch(`/api/tareas/categoria/${categoria}`);
            const { data } = await response.json();
            list.innerHTML = data.length ? data.map(t => `
                <div class="list-item ${t.estado}">
                    <div><strong>${t.descripcion}</strong><br><small>Paciente: ${t.paciente_nombre} (Hab: ${t.paciente_habitacion || 'N/A'})</small></div>
                    <select class="form-select w-auto estado-select" data-id="${t.id}">
                        <option value="en curso" ${t.estado === 'en curso' ? 'selected' : ''}>En Curso</option>
                        <option value="terminada" ${t.estado === 'terminada' ? 'selected' : ''}>Terminada</option>
                    </select>
                </div>
            `).join('') : '<p>No hay tareas en esta categoría.</p>';
        }
    });

    mainContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        if (form.id === 'paciente-form') {
            const id = form.dataset.id;
            const url = id ? `/api/pacientes/${id}` : '/api/pacientes';
            const method = id ? 'PUT' : 'POST';
            await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            renderView('pacientes');
        }

        if (form.id === 'tarea-form') {
            await fetch('/api/tareas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            renderView('calendario');
        }
    });
    
    mainContent.addEventListener('change', async (e) => {
        if (e.target.matches('.estado-select')) {
            const id = e.target.dataset.id;
            const estado = e.target.value;
            await fetch(`/api/tareas/${id}/estado`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
            e.target.closest('.list-item').className = `list-item ${estado}`;
        }
    });

    // --- VISTA INICIAL ---
    renderCalendarioView();
});