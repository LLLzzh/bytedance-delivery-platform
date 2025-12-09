import { Coordinates } from "../../shared/geo.types.js";

/**
 * 根据经纬度判断省份（简化版，基于主要城市的经纬度范围）
 * 注意：这是一个简化实现，实际生产环境建议使用专业的逆地理编码服务
 */
export function getProvinceByCoordinates(coords: Coordinates): string {
  const [lng, lat] = coords;

  // 中国主要省份的经纬度范围（简化判断）
  // 北京
  if (lng >= 116.0 && lng <= 117.0 && lat >= 39.5 && lat <= 40.5) {
    return "北京市";
  }
  // 上海
  if (lng >= 121.0 && lng <= 122.0 && lat >= 31.0 && lat <= 32.0) {
    return "上海市";
  }
  // 广东（广州）
  if (lng >= 113.0 && lng <= 114.0 && lat >= 23.0 && lat <= 24.0) {
    return "广东省";
  }
  // 浙江（杭州）
  if (lng >= 120.0 && lng <= 121.0 && lat >= 30.0 && lat <= 31.0) {
    return "浙江省";
  }
  // 江苏（南京）
  if (lng >= 118.0 && lng <= 119.0 && lat >= 32.0 && lat <= 33.0) {
    return "江苏省";
  }
  // 山东（济南）
  if (lng >= 117.0 && lng <= 118.0 && lat >= 36.0 && lat <= 37.0) {
    return "山东省";
  }
  // 四川（成都）
  if (lng >= 104.0 && lng <= 105.0 && lat >= 30.5 && lat <= 31.0) {
    return "四川省";
  }
  // 湖北（武汉）
  if (lng >= 114.0 && lng <= 115.0 && lat >= 30.0 && lat <= 31.0) {
    return "湖北省";
  }
  // 河南（郑州）
  if (lng >= 113.5 && lng <= 114.5 && lat >= 34.5 && lat <= 35.0) {
    return "河南省";
  }
  // 陕西（西安）
  if (lng >= 108.5 && lng <= 109.5 && lat >= 34.0 && lat <= 35.0) {
    return "陕西省";
  }
  // 天津
  if (lng >= 117.0 && lng <= 118.0 && lat >= 39.0 && lat <= 40.0) {
    return "天津市";
  }
  // 重庆
  if (lng >= 106.0 && lng <= 107.0 && lat >= 29.5 && lat <= 30.5) {
    return "重庆市";
  }
  // 福建（福州）
  if (lng >= 119.0 && lng <= 120.0 && lat >= 26.0 && lat <= 27.0) {
    return "福建省";
  }
  // 湖南（长沙）
  if (lng >= 112.5 && lng <= 113.5 && lat >= 28.0 && lat <= 29.0) {
    return "湖南省";
  }
  // 安徽（合肥）
  if (lng >= 117.0 && lng <= 118.0 && lat >= 31.5 && lat <= 32.5) {
    return "安徽省";
  }
  // 河北（石家庄）
  if (lng >= 114.0 && lng <= 115.0 && lat >= 38.0 && lat <= 39.0) {
    return "河北省";
  }
  // 辽宁（沈阳）
  if (lng >= 123.0 && lng <= 124.0 && lat >= 41.5 && lat <= 42.5) {
    return "辽宁省";
  }
  // 吉林（长春）
  if (lng >= 125.0 && lng <= 126.0 && lat >= 43.5 && lat <= 44.5) {
    return "吉林省";
  }
  // 黑龙江（哈尔滨）
  if (lng >= 126.0 && lng <= 127.0 && lat >= 45.5 && lat <= 46.5) {
    return "黑龙江省";
  }
  // 内蒙古（呼和浩特）
  if (lng >= 111.5 && lng <= 112.5 && lat >= 40.5 && lat <= 41.5) {
    return "内蒙古自治区";
  }
  // 山西（太原）
  if (lng >= 112.0 && lng <= 113.0 && lat >= 37.5 && lat <= 38.5) {
    return "山西省";
  }
  // 江西（南昌）
  if (lng >= 115.5 && lng <= 116.5 && lat >= 28.5 && lat <= 29.5) {
    return "江西省";
  }
  // 广西（南宁）
  if (lng >= 108.0 && lng <= 109.0 && lat >= 22.5 && lat <= 23.5) {
    return "广西壮族自治区";
  }
  // 云南（昆明）
  if (lng >= 102.5 && lng <= 103.5 && lat >= 25.0 && lat <= 26.0) {
    return "云南省";
  }
  // 贵州（贵阳）
  if (lng >= 106.5 && lng <= 107.5 && lat >= 26.5 && lat <= 27.5) {
    return "贵州省";
  }
  // 新疆（乌鲁木齐）
  if (lng >= 87.0 && lng <= 88.0 && lat >= 43.5 && lat <= 44.5) {
    return "新疆维吾尔自治区";
  }
  // 西藏（拉萨）
  if (lng >= 91.0 && lng <= 92.0 && lat >= 29.5 && lat <= 30.5) {
    return "西藏自治区";
  }
  // 青海（西宁）
  if (lng >= 101.5 && lng <= 102.5 && lat >= 36.5 && lat <= 37.5) {
    return "青海省";
  }
  // 甘肃（兰州）
  if (lng >= 103.5 && lng <= 104.5 && lat >= 36.0 && lat <= 37.0) {
    return "甘肃省";
  }
  // 宁夏（银川）
  if (lng >= 106.0 && lng <= 107.0 && lat >= 38.0 && lat <= 39.0) {
    return "宁夏回族自治区";
  }
  // 海南（海口）
  if (lng >= 110.0 && lng <= 111.0 && lat >= 20.0 && lat <= 21.0) {
    return "海南省";
  }

  // 默认返回"未知省份"
  return "未知省份";
}

/**
 * 根据经纬度判断城市（简化版）
 * 注意：这是一个简化实现，实际生产环境建议使用专业的逆地理编码服务
 */
export function getCityByCoordinates(coords: Coordinates): string {
  const [lng, lat] = coords;

  // 主要城市判断（简化版）
  // 北京
  if (lng >= 116.0 && lng <= 117.0 && lat >= 39.5 && lat <= 40.5) {
    return "北京市";
  }
  // 上海
  if (lng >= 121.0 && lng <= 122.0 && lat >= 31.0 && lat <= 32.0) {
    return "上海市";
  }
  // 广州
  if (lng >= 113.0 && lng <= 114.0 && lat >= 23.0 && lat <= 24.0) {
    return "广州市";
  }
  // 深圳
  if (lng >= 114.0 && lng <= 114.5 && lat >= 22.5 && lat <= 23.0) {
    return "深圳市";
  }
  // 杭州
  if (lng >= 120.0 && lng <= 120.5 && lat >= 30.0 && lat <= 30.5) {
    return "杭州市";
  }
  // 南京
  if (lng >= 118.5 && lng <= 119.0 && lat >= 32.0 && lat <= 32.5) {
    return "南京市";
  }
  // 成都
  if (lng >= 104.0 && lng <= 104.5 && lat >= 30.5 && lat <= 31.0) {
    return "成都市";
  }
  // 武汉
  if (lng >= 114.0 && lng <= 114.5 && lat >= 30.5 && lat <= 31.0) {
    return "武汉市";
  }
  // 西安
  if (lng >= 108.5 && lng <= 109.5 && lat >= 34.0 && lat <= 34.5) {
    return "西安市";
  }
  // 天津
  if (lng >= 117.0 && lng <= 118.0 && lat >= 39.0 && lat <= 40.0) {
    return "天津市";
  }
  // 重庆
  if (lng >= 106.5 && lng <= 107.0 && lat >= 29.5 && lat <= 30.0) {
    return "重庆市";
  }

  // 默认返回"未知城市"
  return "未知城市";
}
