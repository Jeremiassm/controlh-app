// public/app.js - VERSIÓN FINAL Y CORREGIDA

document.addEventListener('DOMContentLoaded', () => {
    console.log("ControlH app.js vDefinitiva cargado y listo.");

    // --- ELEMENTOS PRINCIPALES ---
    const mainContent = document.getElementById('main-content');
    const homeTitle = document.getElementById('home-title');
    const navButtons = document.querySelectorAll('[data-view]');
    const dayTasksModal = new bootstrap.Modal(document.getElementById('day-tasks-modal'));
    let calendar = null; // Para manejar la instancia del calendario

    const categorias = ["Sala", "Materiales", "Cultivos", "Interconsulta", "Alta", "Rx", "Laboratorio", "TNM", "POI", "PreQx", "CxHoy"];

    // =======================================================
    // === NAVEGACIÓN PRINCIPAL (UNIFICADA) ===
    // =======================================================
    
    // Escucha los 4 botones de navegación
    navButtons.forEach(button => {
        button.addEventListener('click', () => renderView(button.dataset.view));
    });

    // Escucha el título "ControlH" para ir al calendario
    homeTitle.addEventListener('click', () => renderView('calendario'));

    // "Router" que decide qué vista dibujar
    function renderView(viewName) {
        // Destruye el calendario si existe, para evitar conflictos
        if (calendar) {
            calendar.destroy();
            calendar = null;
        }
        mainContent.innerHTML = ''; // Limpia la vista anterior

        switch (viewName) {
            case 'pendientes': renderTareasPendientes(); break;
            case 'tareas': renderTareaForm(); break;
            case 'pacientes': renderPacientes(); break;
            case 'categorias': renderCategorias(); break;
            case 'calendario': renderCalendar(); break;
            default: renderCalendar(); // La vista por defecto es el calendario
        }
    }

    // =======================================================
    // === MANEJADOR DE ACCIONES DENTRO DE LAS VISTAS ===
    // =======================================================

    // Un solo listener para todas las acciones (botones, formularios, etc.)
    mainContent.addEventListener('click', async (e) => {
        const target = e.target;
        
        // Marcar tarea como TERMINADA
        if (target.matches('.complete-btn')) {
            e.preventDefault();
            await updateTaskStatus(target.dataset.id, 'terminada');
        }
        
        // Marcar tarea como EN CURSO (Deshacer)
        if (target.matches('.undo-btn')) {
            e.preventDefault();
            await updateTaskStatus(target.dataset.id, 'en curso');
        }

        // Ver tareas por categoría
        if (target.matches('[data-cat]')) {
            fetchTareasPorCategoria(target.dataset.cat);
        }
    });

    // Manejador para el envío de formularios
    mainContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        if (form.id === 'form-tarea') {
            const payload = {
                descripcion: form.descripcion.value,
                categoria: form.categoria.value,
                paciente_id: form.paciente_id.value
            };
            const res = await fetch('/api/tareas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert('Tarea guardada');
                renderView('pendientes');
            } else {
                alert('Error al guardar la tarea');
            }
        }
    });

    // Función centralizada para actualizar estado
    async function updateTaskStatus(id, estado) {
        const response = await fetch(`/api/tareas/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        if (response.ok) {
            renderTareasPendientes(); // Refresca la lista para mostrar el cambio
        } else {
            alert('No se pudo actualizar la tarea.');
        }
    }

    // =======================================================
    // === FUNCIONES QUE DIBUJAN CADA VISTA ===
    // =======================================================

    async function renderCalendar() {
        mainContent.innerHTML = `<div id="calendar"></div>`;
        const calendarEl = document.getElementById('calendar');

        try {
            const response = await fetch('/api/tareas/all');
            const { data } = await response.json();
            const events = data.map(tarea => ({
                id: tarea.id,
                title: `(${tarea.categoria}) ${tarea.descripcion}`,
                start: tarea.fecha_creacion,
                color: tarea.estado === 'terminada' ? '#198754' : '#0d6efd',
                extendedProps: { ...tarea }
            }));
            
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'es',
                height: 'auto',
                events: events,
                dateClick: (info) => {
                    const tasksOfDay = events.filter(event => event.start.startsWith(info.dateStr));
                    const modalTitle = document.getElementById('modal-title');
                    const modalBody = document.getElementById('modal-body');
                    modalTitle.textContent = `Tareas del ${info.dateStr}`;
                    if (tasksOfDay.length > 0) {
                        modalBody.innerHTML = '<ul class="list-group">' + tasksOfDay.map(e =>
                            `<li class="list-group-item ${e.extendedProps.estado === 'terminada' ? 'text-decoration-line-through' : ''}">${e.title}</li>`
                        ).join('') + '</ul>';
                    } else {
                        modalBody.innerHTML = '<p>No hay tareas registradas en esta fecha.</p>';
                    }
                    dayTasksModal.show();
                }
            });
            calendar.render();
        } catch (error) {
            mainContent.innerHTML = '<h2>Error al cargar el calendario</h2>';
            console.error(error);
        }
    }

    async function renderTareasPendientes() {
        mainContent.innerHTML = '<h2>Tareas del Día y Pendientes</h2><p>Cargando...</p>';
        try {
            const res = await fetch('/api/tareas/all');
            const json = await res.json();
            
            const hoy = new Date().toISOString().slice(0, 10);
            const tareasAMostrar = json.data.filter(t => t.estado === 'en curso' || t.fecha_creacion.startsWith(hoy));
            
            tareasAMostrar.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

            if (tareasAMostrar.length === 0) {
                mainContent.innerHTML = '<h2>Tareas del Día y Pendientes</h2><p>¡Excelente! No hay tareas para hoy.</p>';
                return;
            }

            mainContent.innerHTML = `
                <h2>Tareas del Día y Pendientes</h2>
                <div class="item-list">
                  ${tareasAMostrar.map(t => {
                    const isTerminada = t.estado === 'terminada';
                    return `
                        <div class="list-item ${isTerminada ? 'terminada' : 'en-curso'}">
                          <div>
                            <strong>${t.descripcion}</strong><br>
                            <small><b>Paciente:</b> ${t.paciente_nombre || 'Sin asignar'}</small><br>
                            <small><b>Categoría:</b> ${t.categoria}</small>
                          </div>
                          <div class="item-actions">
                            ${isTerminada
                                ? `<button class="btn btn-sm btn-warning undo-btn" data-id="${t.id}">↺ Deshacer</button>`
                                : `<button class="btn btn-sm btn-success complete-btn" data-id="${t.id}">✔ Terminar</button>`
                            }
                          </div>
                        </div>
                      `;
                  }).join('')}
                </div>
            `;
        } catch (err) {
            mainContent.innerHTML = '<p>Error al cargar las tareas.</p>';
            console.error(err);
        }
    }

    async function renderTareaForm() {
        const pacientesRes = await fetch('/api/pacientes');
        const pacientesData = await pacientesRes.json();
        const pacientes = pacientesData.data;
        mainContent.innerHTML = `
            <h2>Agregar Tarea</h2>
            <form id="form-tarea">
                <input class="form-control" type="text" name="descripcion" placeholder="Descripción de la tarea" required />
                <select class="form-select" name="categoria" required>
                    <option value="">Seleccionar categoría</option>
                    ${categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
                <select class="form-select" name="paciente_id" required>
                  <option value="">Seleccionar paciente</option>
                  ${pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                </select>
                <button class="btn btn-primary" type="submit">Guardar</button>
            </form>
        `;
    }
    
    async function renderPacientes() {
        const res = await fetch('/api/pacientes');
        const data = await res.json();
        const pacientes = data.data;
        mainContent.innerHTML = `
            <h2>Pacientes</h2>
            <div class="item-list">
                ${pacientes.map(p => `
                <div class="list-item">
                    <div>
                    <strong>${p.nombre}</strong><br>
                    <small>Habitación: ${p.habitacion || 'Sin asignar'}</small>
                    </div>
                </div>
                `).join('')}
            </div>
        `;
    }
    
    function renderCategorias() {
        mainContent.innerHTML = `
            <h2>Categorías</h2>
            <div class="mobile-nav mb-3">
            ${categorias.map(cat => `<button class="btn btn-secondary" data-cat="${cat}">${cat}</button>`).join('')}
            </div>
            <div id="categoria-tareas"></div>
        `;
    }
    
    async function fetchTareasPorCategoria(categoria) {
        const contenedor = document.getElementById('categoria-tareas');
        contenedor.innerHTML = `<p>Cargando tareas de <strong>${categoria}</strong>...</p>`;
        try {
            const res = await fetch(`/api/tareas/categoria/${encodeURIComponent(categoria)}`);
            const json = await res.json();
            const tareas = json.data;
            if (!tareas.length) {
                contenedor.innerHTML = `<p>No hay tareas de <strong>${categoria}</strong> en curso.</p>`;
                return;
            }
            contenedor.innerHTML = `
            <h4 class="mt-3">Tareas de ${categoria}</h4>
            <div class="item-list">
                ${tareas.map(t => `
                <div class="list-item en-curso">
                    <div>
                    <strong>${t.descripcion}</strong><br>
                    <small><b>Paciente:</b> ${t.paciente_nombre || 'Sin asignar'}</small><br>
                    <small><b>Habitación:</b> ${t.paciente_habitacion || '-'}</small>
                    </div>
                </div>
                `).join('')}
            </div>
            `;
        } catch (error) {
            console.error("Error al buscar tareas por categoría:", error);
            contenedor.innerHTML = `<p>Error al cargar las tareas.</p>`;
        }
    }

    // --- VISTA INICIAL ---
    renderView('calendario');
});