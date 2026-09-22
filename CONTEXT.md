# Urban Environmental Digital Twin Platform

Nền tảng biểu diễn các địa điểm đô thị vật lý trong không gian 3D và gắn dữ liệu môi trường theo thời gian để quan sát, mô phỏng và phân tích.

## Language

**Customer**:
Ranh giới sở hữu và phân quyền cao nhất của hệ thống; một Customer account có thể có nhiều User, Site và Digital Twin.
_Avoid_: Organization, Tenant, customer user

**Customer Membership**:
Quan hệ cho phép một User truy cập một Customer account với một vai trò xác định.
_Avoid_: Organization membership, user ownership

**Admin**:
Người vận hành nền tảng có toàn quyền đối với mọi Customer và dữ liệu trong ứng dụng.
_Avoid_: Customer admin, tenant admin

**Customer User**:
Người dùng chỉ có quyền đọc đối với các Customer được cấp qua Customer Membership.
_Avoid_: Admin, Customer account, Organization user

**Site**:
Một địa điểm vật lý có danh tính và ranh giới địa lý ổn định, thuộc một Customer và có đúng một Digital Twin.
_Avoid_: Area, location, Digital Twin

**Digital Twin**:
Biểu diễn số theo thời gian của đúng một Site, bao gồm các lớp không gian, trạng thái và dữ liệu quan sát hoặc suy diễn của Site đó.
_Avoid_: Project, Site, service, 3D file

**Capability**:
Một năng lực môi trường được áp dụng lên Digital Twin; phạm vi hiện tại chỉ có Air Quality.
_Avoid_: Digital Twin, Project, service type

## Ownership

**Customer Site**:
Một Site thuộc đúng một Customer và không được dùng chung giữa các Customer, kể cả khi các ranh giới địa lý trùng nhau.
_Avoid_: Global Site, shared Site

## Observation

**Sensor**:
Một trạm hoặc thiết bị tại một vị trí trong Digital Twin, có thể quan sát nhiều Parameter.
_Avoid_: Parameter, measurement series

**Virtual Sensor**:
Sensor không đại diện cho phần cứng đang triển khai ngoài đời và được dùng làm điểm quan sát cho dữ liệu mô phỏng.
_Avoid_: Physical Sensor, simulated measurement

**Physical Sensor**:
Sensor đại diện cho một thiết bị quan trắc được triển khai ngoài đời, bất kể Measurement liên quan được đo, mô phỏng hay ước tính.
_Avoid_: Virtual Sensor, measured data

**Parameter**:
Một đại lượng môi trường có thể được Sensor quan sát hoặc hệ thống mô phỏng, như PM2.5, PM10, NO2 hoặc CO2.
_Avoid_: Sensor type, layer

**Measurement**:
Một giá trị của một Parameter tại một Sensor và thời điểm quan sát, kèm đơn vị và nguồn gốc dữ liệu bắt buộc.
_Avoid_: Sensor, current state

**Measured Data**:
Dữ liệu quan sát được từ thiết bị hoặc một nguồn đo thực tế.
_Avoid_: Simulated Data, Estimated Data, real-looking data

**Simulated Data**:
Dữ liệu được tạo bởi mô hình hoặc kịch bản và không khẳng định đã xảy ra ngoài đời.
_Avoid_: Measured Data, Estimated Data

**Estimated Data**:
Dữ liệu suy ra cho một thời điểm hoặc vị trí thực từ observation hay quy tắc, thay vì được đo trực tiếp.
_Avoid_: Simulated Data, Measured Data

**Simulation Run**:
Một lần chạy có danh tính riêng, tạo trước một chuỗi dữ liệu trong khoảng thời gian xác định và dùng để truy nguyên tập Simulated Data đó.
_Avoid_: Digital Twin version

**Synthetic Urban Monitoring**:
Hoạt động quan sát Digital Twin theo thời gian bằng Virtual Sensor và Simulated Data, mô phỏng workflow quan trắc nhưng không tuyên bố phản ánh điều kiện hiện trường.
_Avoid_: Live monitoring, field monitoring, measured monitoring
