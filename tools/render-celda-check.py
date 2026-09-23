"""Headless visual check: blender -b -t 4 -P tools/render-celda-check.py -- input.glb output.png"""
import sys
import bpy
from mathutils import Vector

source, output, *options = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 1600
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'BOTH'
scene.display.shading.background_type = 'WORLD'
scene.world = bpy.data.worlds.new('Review background')
scene.world.color = (0.12, 0.12, 0.12)
if '--materials' in options:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.4, 0.4, 0.4, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.5
    sun = bpy.data.lights.new('Review sun', 'SUN')
    sun.energy = 2
    light = bpy.data.objects.new('Review sun', sun)
    scene.collection.objects.link(light)
    light.rotation_euler = (0.4, -0.6, -0.3)
camera = bpy.data.cameras.new('Review camera')
obj = bpy.data.objects.new('Review camera', camera)
scene.collection.objects.link(obj)
target = Vector((-3.5, 0.0, 1.0))
obj.location = target + Vector((2.3, 4.2, 4.5))
obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera.type = 'ORTHO'
camera.ortho_scale = 4.5
scene.camera = obj
scene.render.filepath = output
bpy.ops.render.render(write_still=True)
