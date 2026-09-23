# -*- coding: utf-8 -*-
"""Del Dron.blend de Jorge (el FBX de Fusion, dron dentro de su caja) a los
dos .glb del sitio:

  dron.glb   solo el dron montado, una pieza por grupo para el despiece:
             carcasas, PCB, cuatro motores y cuatro helices. La PCB va
             partida: la placa (con sus capas de cobre y serigrafia) es
             `pcb`, y cada componente soldado es su propia pieza `pcbc_NN`,
             para que se despiecen de la placa.
  empaque.glb  la caja completa: el dron, la caja con su espuma y el manual,
             el estuche de helices, el cable y las baterias de repuesto.

    blender -b RUTA/Dron.blend --python tools/exportar-dron.py -- SALIDA_DIR

Lee el .blend y NUNCA lo guarda: todo se hace en memoria y se exporta.

El FBX trae 23,7 M de triangulos (18,3 M solo la PCB). El presupuesto se
reparte por SUPERFICIE de cada malla (su diagonal al cuadrado), no a partes
iguales: asi las piezas pequenas no se llevan medio millon de triangulos para
ocupar diez pixeles, que fue la leccion de la celda.

Ojo: los reductores se APLICAN antes de unir. `join()` descarta los
modificadores de todo lo que no es el objeto activo, y el .glb salia con
todos los triangulos (ver memoria modelo-3d-celda).
"""
import os
import sys

import math

import bmesh
import bpy
from mathutils import Vector

SALIDA = sys.argv[sys.argv.index("--") + 1]

# Grupos del dron: nombre en el .blend -> nombre de la pieza en el .glb.
DRON = {
    "Tapa superior:1": "carcasa_superior",
    "Tapa inferior:1": "carcasa_inferior",
    "PCB:1": "pcb",  # se parte en placa y componentes (ver partir_pcb)
    "DC MOTOR ID:1": "motor_1",
    "DC MOTOR II v1:1": "motor_2",
    "DC MOTORS SD:1": "motor_3",
    "DC MOTORS SI:1": "motor_4",
    "Helice:2": "helice_1",
    "Helice:4": "helice_2",
    "Helice:5": "helice_3",
    "Helice:6": "helice_4",
}
EMPAQUE_EXTRA = {
    "Caja de embalaje v1:1": "caja",
    "Empaque helices:1": "estuche_helices",
    "Cable USB B :1": "cable_usb",
    "battery-lipo-3.7v-604050 v4:2": "bateria_1",
    "battery-lipo-3.7v-604050 v4:4": "bateria_2",
}
RAIZ = "DRON COMPLETO ESPUMA v70"
# Triangulos por pieza del .glb. Se reparte por PIEZA y no por malla suelta:
# por mallas, los cuatro motores (36 mallitas cada uno) se llevaban mas de la
# mitad del presupuesto y la PCB, que es lo que se mira, se quedaba corta.
# Dentro de cada pieza, cada malla recibe su parte segun su superficie.
PRESUPUESTO = {
    "carcasa_superior": 70000, "carcasa_inferior": 40000, "pcb": 40000,
    # Los motores se quedan en ~60 k cada uno: sus 12 bobinas son espiras de
    # hilo sueltas y el reductor no puede fundirlas. La remalla por voxeles
    # tumbaba Blender. Pesa poco en el .glb final (4,3 MB con todo).
    "motor_1": 14000, "motor_2": 14000, "motor_3": 14000, "motor_4": 14000,
    "helice_1": 4000, "helice_2": 4000, "helice_3": 4000, "helice_4": 4000,
    # Presupuesto COMUN de todos los componentes de la PCB (`pcbc_*`),
    # repartido por superficie como el resto.
    "pcb_componentes": 90000,
    "caja": 4000, "estuche_helices": 30000, "cable_usb": 6000,
    "bateria_1": 1600, "bateria_2": 1600,
}
# Las carcasas son casi todo caras planas. El colapso de aristas las doblaba:
# la tapa de arriba salia arrugada alrededor del agujero pequeño. A estas se
# les disuelve lo coplanar, que no mueve ningun vertice fuera de su plano.
PLANAS = {"carcasa_superior", "carcasa_inferior"}
# La placa desnuda y dos copias identicas de un mismo componente (una
# "_Editado"): con las dos, parpadean una sobre la otra.
PLACA = "MeshBody350"
DUPLICADOS = {"MeshBody13"}
# Los componentes sueltos de la raiz (serigrafia y SMD sobre la carcasa) van
# con la carcasa superior.
SUELTOS = "carcasa_superior"


def mallas_de(obj):
    return [o for o in [obj] + list(obj.children_recursive) if o.type == "MESH"]


def diag(o):
    return (o.matrix_world.to_3x3() @ Vector(o.dimensions)).length


def caja_mundo(o):
    ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector(map(min, *ws)), Vector(map(max, *ws))


def partir_pcb(fuente):
    """Mallas de la PCB -> pieza. Lo que cabe dentro del grosor de la placa
    (cobre, serigrafia, capas internas) va con ella; lo que asoma por
    arriba o por abajo es un componente y sale como pieza propia. Se numeran
    de un lado a otro para que el despiece los levante en orden."""
    mn, mx = caja_mundo(bpy.data.objects[PLACA])
    placa, sueltas = {}, []
    for m in mallas_de(bpy.data.objects[fuente]):
        if m.name in DUPLICADOS:
            continue
        a, b = caja_mundo(m)
        if m.name == PLACA or (a.z >= mn.z - 1e-4 and b.z <= mx.z + 1e-4):
            placa[m] = "pcb"
        else:
            sueltas.append(m)
    sueltas.sort(key=lambda m: tuple(round(v, 3) for v in sum(caja_mundo(m), Vector()) / 2))
    for i, m in enumerate(sueltas):
        placa[m] = "pcbc_%02d" % i
    return placa


def tapar_huecos(m, max_hueco=12.0, afilado=math.radians(30)):
    """El FBX de Fusion trae la carcasa de arriba con 8 ventanas SIN caras en
    las paredes del octogono (dos por lado): por ellas se veia el interior,
    oscuro, como un agujero. Se sueldan los vertices, se tapan los bordes
    abiertos pequenos (el borde de abajo de la tapa, que si va abierto, mide
    diez veces mas; el agujero redondo de arriba, que es de diseño, tampoco)
    y se marcan como vivas las aristas de mas de 30 grados,
    para que el sombreado suave no corra de una cara a otra."""
    bm = bmesh.new()
    bm.from_mesh(m.data)
    escala = max(m.matrix_world.to_scale())
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4 / escala)
    vistas, tapar = set(), []
    for e in [e for e in bm.edges if e.is_boundary]:
        if e in vistas:
            continue
        lazo, pila = [], [e]
        while pila:
            x = pila.pop()
            if x in vistas:
                continue
            vistas.add(x)
            lazo.append(x)
            pila += [y for v in x.verts for y in v.link_edges if y.is_boundary and y not in vistas]
        pts = [m.matrix_world @ v.co for x in lazo for v in x.verts]
        tam = Vector(map(max, *pts)) - Vector(map(min, *pts))
        # Las ventanas estan en paredes verticales. El agujero redondo de
        # arriba de la tapa es de diseño y va en horizontal: ese se queda.
        if tam.length < max_hueco and (tam.z > 0.3 or tam.length < 1.0):
            tapar += lazo
    n = len(bmesh.ops.holes_fill(bm, edges=tapar, sides=0)["faces"]) if tapar else 0
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    for e in bm.edges:
        e.smooth = not (e.is_manifold and e.calc_face_angle(0) > afilado)
    bm.to_mesh(m.data)
    bm.free()
    return n


def presupuesto_de(destino):
    return "pcb_componentes" if destino.startswith("pcbc_") else destino


def triangulos(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def construir(grupos, nombre_raiz):
    """Una malla por grupo, reducida y con el origen en su centro."""
    raiz = bpy.data.objects[RAIZ]
    asignacion = {}
    for fuente, destino in grupos.items():
        if destino == "pcb":
            asignacion.update(partir_pcb(fuente))
            continue
        for m in mallas_de(bpy.data.objects[fuente]):
            asignacion[m] = destino
    for c in raiz.children:
        if c.type == "MESH" and c not in asignacion:
            asignacion[c] = SUELTOS

    area = {m: max(diag(m), 1e-6) ** 2 for m in asignacion}
    total = {}
    for m, destino in asignacion.items():
        total[presupuesto_de(destino)] = total.get(presupuesto_de(destino), 0) + area[m]
    dg = bpy.context.evaluated_depsgraph_get()
    nuevas = {}
    antes = despues = 0
    for m, destino in asignacion.items():
        n = triangulos(m)
        antes += n
        grupo = presupuesto_de(destino)
        tope = max(40, int(PRESUPUESTO[grupo] * area[m] / total[grupo]))
        if destino in PLANAS and n > tope:
            # Solo la carcasa en si, no las marcas de la serigrafia: son
            # mallas sueltas diminutas y soldarlas las aplastaba.
            print("   %s: %d huecos tapados" % (m.name, tapar_huecos(m)))
            plano = m.modifiers.new("planos", "DECIMATE")
            plano.decimate_type = "DISSOLVE"
            plano.angle_limit = 0.0175  # 1 grado
            plano.delimit = {"NORMAL"}
            m.modifiers.new("triangular", "TRIANGULATE")
        elif destino not in PLANAS and n > tope:
            # CAD exporta cada cara con sus vertices separados en las aristas, y
            # el reductor no colapsa a traves de esas costuras: sin soldar
            # antes no hay colapso posible a traves de ellas.
            soldar = m.modifiers.new("soldar", "WELD")
            soldar.merge_threshold = 1e-4
            mod = m.modifiers.new("reducir", "DECIMATE")
            mod.ratio = tope / n
    dg.update()
    for m, destino in asignacion.items():
        me = bpy.data.meshes.new_from_object(m.evaluated_get(dg))
        me.transform(m.matrix_world)
        despues += sum(len(p.vertices) - 2 for p in me.polygons)
        o = bpy.data.objects.new(destino, me)
        bpy.context.collection.objects.link(o)
        nuevas.setdefault(destino, []).append(o)

    # Fuera todo lo original: ya esta copiado y reducido.
    for o in list(bpy.data.objects):
        if not any(o in lista for lista in nuevas.values()):
            bpy.data.objects.remove(o, do_unlink=True)

    piezas = []
    for destino, lista in nuevas.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in lista:
            o.select_set(True)
        bpy.context.view_layer.objects.active = lista[0]
        if len(lista) > 1:
            bpy.ops.object.join()
        pieza = bpy.context.view_layer.objects.active
        pieza.name = pieza.data.name = destino
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
        for p in pieza.data.polygons:
            p.use_smooth = True
        piezas.append(pieza)

    # Centrado en el origen y a 1 m de lado mayor: el visor lo reencaja igual,
    # pero asi el archivo es comodo de abrir en cualquier lado.
    bpy.context.view_layer.update()
    mn = Vector((1e9,) * 3)
    mx = -mn
    for p in piezas:
        for c in p.bound_box:
            w = p.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w))
            mx = Vector(map(max, mx, w))
    centro = (mn + mx) / 2
    escala = 1.0 / max(mx - mn)
    raiz_nueva = bpy.data.objects.new(nombre_raiz, None)
    bpy.context.collection.objects.link(raiz_nueva)
    for p in piezas:
        p.location = (p.location - centro) * escala
        p.scale = (escala,) * 3
        p.parent = raiz_nueva
    return antes, despues, {p.name: triangulos(p) for p in piezas}


def exportar(ruta):
    bpy.ops.export_scene.gltf(
        filepath=ruta,
        export_format="GLB",
        export_apply=True,
        export_animations=False,
        export_yup=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=16,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )


def informe(nombre, antes, despues, piezas, ruta):
    print("%s: %d -> %d triangulos, %.2f MB" % (nombre, antes, despues, os.path.getsize(ruta) / 1e6))
    for k, v in sorted(piezas.items()):
        print("   %-18s %d" % (k, v))


if __name__ == "__main__":
    os.makedirs(SALIDA, exist_ok=True)
    fuente = bpy.data.filepath

    antes, despues, piezas = construir(DRON, "Dron")
    ruta = os.path.join(SALIDA, "dron.glb")
    exportar(ruta)
    informe("dron", antes, despues, piezas, ruta)

    # Se vuelve a abrir el .blend limpio para el empaque (sin guardar nada).
    bpy.ops.wm.open_mainfile(filepath=fuente)
    grupos = dict(DRON)
    grupos.update(EMPAQUE_EXTRA)
    antes, despues, piezas = construir(grupos, "Empaque")
    ruta = os.path.join(SALIDA, "empaque.glb")
    exportar(ruta)
    informe("empaque", antes, despues, piezas, ruta)
